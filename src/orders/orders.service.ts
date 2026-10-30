import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { Game } from 'src/games/entities/game.entity';
import { UserRole } from 'src/users/entities/user.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { StoreVisitsService } from 'src/store-visits/store-visits.service';
import { GamePlaysService } from 'src/game-plays/game-plays.service';
import { isUniqueViolation } from 'src/common/database-errors';
import { MenuItem } from './entities/menu-item.entity';
import { OrderTab, OrderTabStatus } from './entities/order-tab.entity';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem, OrderItemKind } from './entities/order-item.entity';
import {
  CreateMenuItemDto,
  MenuQueryDto,
  UpdateMenuItemDto,
} from './dto/menu.dto';
import {
  CreateOrderDto,
  OpenTabDto,
  OrderItemInputDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import {
  canTransition,
  customerMessage,
  isHelpCall,
  orderTotal,
  shouldNotifyCustomer,
  startOfStoreDay,
  tabTotal,
} from './orders.rules';

const STAFF_FEED_LIMIT = 100;
const ORDER_RELATIONS = { items: true, tab: true } as const;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(MenuItem)
    private menuRepository: Repository<MenuItem>,
    @InjectRepository(OrderTab)
    private tabRepository: Repository<OrderTab>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    private storeVisitsService: StoreVisitsService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
    private gamePlaysService: GamePlaysService,
  ) {}

  listMenu(query: MenuQueryDto, isAdmin: boolean) {
    return this.menuRepository.find({
      where: {
        ...(query.all && isAdmin ? {} : { available: true }),
        ...(query.dailySpecial ? { dailySpecial: true } : {}),
      },
      order: { category: 'ASC', sortOrder: 'ASC', name: 'ASC' },
    });
  }

  createMenuItem(dto: CreateMenuItemDto) {
    return this.menuRepository.save(this.menuRepository.create(dto));
  }

  async updateMenuItem(id: string, dto: UpdateMenuItemDto) {
    const item = await this.menuRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Item do cardápio não encontrado.');
    Object.assign(item, dto);
    return this.menuRepository.save(item);
  }

  async deleteMenuItem(id: string) {
    const result = await this.menuRepository.delete(id);
    if (!result.affected) {
      throw new NotFoundException('Item do cardápio não encontrado.');
    }
    return { message: 'Item removido do cardápio.' };
  }

  async openTab(userId: string, dto: OpenTabDto) {
    const visit = await this.storeVisitsService.hasOpenVisit(userId);
    if (!visit) {
      throw new BadRequestException('Faça check-in na loja antes de pedir.');
    }

    const existing = await this.tabRepository.findOne({
      where: { userId, status: OrderTabStatus.OPEN },
    });
    if (existing) return existing;

    const cardNumber = dto.cardNumber.trim().toUpperCase();
    try {
      return await this.tabRepository.save(
        this.tabRepository.create({
          userId,
          customerName: dto.customerName.trim(),
          cardNumber,
          visitId: visit.id,
        }),
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await this.tabRepository.findOne({
        where: { userId, status: OrderTabStatus.OPEN },
      });
      if (raced) return raced;
      throw new ConflictException(
        'Esse cartão já está em outra comanda aberta. Confira o número.',
      );
    }
  }

  async getMyTab(userId: string) {
    const tab = await this.tabRepository.findOne({
      where: { userId, status: OrderTabStatus.OPEN },
      relations: { orders: { items: true } },
      order: { orders: { createdAt: 'DESC' } },
    });
    return tab ? this.withTotals(tab) : null;
  }

  async createOrder(userId: string, dto: CreateOrderDto) {
    const tab = await this.tabRepository.findOne({
      where: { userId, status: OrderTabStatus.OPEN },
    });
    if (!tab) throw new BadRequestException('Abra uma comanda antes de pedir.');

    const items = await this.buildItems(dto);
    const saved = await this.orderRepository.save(
      this.orderRepository.create({
        tabId: tab.id,
        tableLabel: dto.tableLabel?.trim() || null,
        note: dto.note?.trim() || null,
        items,
      }),
    );
    const order = await this.findOrder(saved.id);

    this.notificationsGateway.emitToStaff('order:new', order);
    const summary = order.items
      .map((item) => `${item.quantity}x ${item.nameSnapshot}`)
      .join(', ');
    this.notificationsService
      .notifyAdmins(
        `${isHelpCall(order) ? 'Chamado de monitor' : 'Novo pedido'} · cartão ${tab.cardNumber}`,
        `${tab.customerName}: ${summary}`,
        { type: 'order', orderId: order.id, staff: true },
        [UserRole.ADMIN, UserRole.WAITER],
      )
      .catch((error: unknown) =>
        this.logger.warn(`Falha no push do pedido: ${String(error)}`),
      );
    return order;
  }

  async cancelOwnOrder(userId: string, orderId: string) {
    const order = await this.findOrder(orderId);
    if (order.tab.userId !== userId) {
      throw new ForbiddenException('Esse pedido não é seu.');
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'O pedido já está sendo preparado; fale com um garçom.',
      );
    }
    const result = await this.orderRepository.update(
      { id: orderId, status: OrderStatus.PENDING },
      {
        status: OrderStatus.CANCELED,
        canceledReason: 'Cancelado pelo cliente',
      },
    );
    if (!result.affected) {
      throw new BadRequestException(
        'O pedido já está sendo preparado; fale com um garçom.',
      );
    }
    return this.publishUpdate(orderId);
  }

  staffFeed(status?: OrderStatus) {
    return this.orderRepository.find({
      where: status ? { status } : {},
      relations: ORDER_RELATIONS,
      order: { createdAt: 'DESC' },
      take: STAFF_FEED_LIMIT,
    });
  }

  async updateStatus(
    staffId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ) {
    const order = await this.findOrder(orderId);
    if (!canTransition(order.status, dto.status)) {
      throw new BadRequestException(
        'Esse pedido não pode mudar para esse status.',
      );
    }

    const result = await this.orderRepository.update(
      { id: orderId, status: order.status },
      {
        status: dto.status,
        handledById: staffId,
        doneAt: dto.status === OrderStatus.DONE ? new Date() : order.doneAt,
        canceledReason:
          dto.status === OrderStatus.CANCELED ? (dto.reason ?? null) : null,
      },
    );
    if (!result.affected) {
      throw new ConflictException(
        'Outro membro da equipe já atualizou esse pedido.',
      );
    }

    const updated = await this.publishUpdate(orderId);
    if (dto.status === OrderStatus.DONE) await this.recordGamePlays(updated);
    if (shouldNotifyCustomer(updated)) await this.notifyCustomer(updated);
    return updated;
  }

  async staffToday() {
    const tabs = await this.tabRepository.find({
      where: [
        { status: OrderTabStatus.OPEN },
        { openedAt: MoreThanOrEqual(startOfStoreDay()) },
      ],
      relations: { orders: { items: true } },
      order: { openedAt: 'DESC', orders: { createdAt: 'DESC' } },
    });
    return tabs.map((tab) => this.withTotals(tab));
  }

  listTabs(status?: OrderTabStatus) {
    return this.tabRepository.find({
      where: status ? { status } : {},
      order: { openedAt: 'DESC' },
      take: STAFF_FEED_LIMIT,
    });
  }

  async closeTab(staffId: string, tabId: string) {
    const tab = await this.tabRepository.findOne({ where: { id: tabId } });
    if (!tab) throw new NotFoundException('Comanda não encontrada.');
    if (tab.status === OrderTabStatus.CLOSED) return tab;

    tab.status = OrderTabStatus.CLOSED;
    tab.closedAt = new Date();
    tab.closedById = staffId;
    const saved = await this.tabRepository.save(tab);
    await this.storeVisitsService.checkOutUser(tab.userId);

    this.notificationsGateway.emitToStaff('tab:closed', saved);
    this.notificationsGateway.emitToUser(tab.userId, 'tab:closed', saved);
    this.notificationsService
      .sendToUser(
        tab.userId,
        'Valeu pela visita!',
        'Conta pra gente como foi: leva 10 segundos.',
        'star',
        'ALERT',
        { type: 'review', visitId: tab.visitId },
      )
      .catch((error: unknown) =>
        this.logger.warn(`Falha ao pedir avaliação: ${String(error)}`),
      );
    return saved;
  }

  @Cron('0 4 * * *', { timeZone: 'America/Sao_Paulo' })
  async closeForgottenTabs() {
    const result = await this.tabRepository.update(
      { status: OrderTabStatus.OPEN },
      { status: OrderTabStatus.CLOSED, closedAt: new Date() },
    );
    if (result.affected) {
      this.logger.log(`${result.affected} comandas fechadas automaticamente`);
    }
  }

  private async buildItems(dto: CreateOrderDto) {
    const menuIds = dto.items
      .filter((item) => item.kind === OrderItemKind.MENU)
      .map((item) => item.menuItemId as string);
    const gameIds = dto.items
      .filter((item) => item.kind !== OrderItemKind.MENU && item.gameId)
      .map((item) => item.gameId as string);

    const [menuItems, games] = await Promise.all([
      menuIds.length
        ? this.menuRepository.find({
            where: { id: In(menuIds), available: true },
          })
        : Promise.resolve([]),
      gameIds.length
        ? this.gameRepository.find({ where: { id: In(gameIds) } })
        : Promise.resolve([]),
    ]);

    return dto.items.map((input) => {
      if (input.kind === OrderItemKind.HELP) {
        return this.buildHelpItem(input, games);
      }
      const source =
        input.kind === OrderItemKind.MENU
          ? menuItems.find((m) => m.id === input.menuItemId)
          : games.find((g) => g.id === input.gameId);
      if (!source) {
        throw new BadRequestException(
          'Um dos itens não está mais disponível. Atualize o cardápio.',
        );
      }
      const item = new OrderItem();
      item.kind = input.kind;
      item.menuItemId = input.kind === OrderItemKind.MENU ? source.id : null;
      item.gameId = input.kind === OrderItemKind.GAME ? source.id : null;
      item.nameSnapshot = source.name;
      item.unitPrice = source instanceof MenuItem ? source.price : 0;
      item.quantity = input.quantity;
      item.note = input.note?.trim() || null;
      return item;
    });
  }

  private buildHelpItem(input: OrderItemInputDto, games: Game[]) {
    const game = input.gameId
      ? games.find((g) => g.id === input.gameId)
      : undefined;
    if (input.gameId && !game) {
      throw new BadRequestException('Jogo não encontrado.');
    }
    const item = new OrderItem();
    item.kind = OrderItemKind.HELP;
    item.menuItemId = null;
    item.gameId = game?.id ?? null;
    item.nameSnapshot = game ? `Ajuda com ${game.name}` : 'Ajuda com um jogo';
    item.unitPrice = 0;
    item.quantity = 1;
    item.note = input.note?.trim() || null;
    return item;
  }

  private async recordGamePlays(order: Order) {
    const playedAt = order.doneAt ?? new Date();
    for (const item of order.items) {
      if (item.kind !== OrderItemKind.GAME || !item.gameId) continue;
      await this.gamePlaysService
        .recordFromOrderItem({
          orderItemId: item.id,
          gameId: item.gameId,
          userId: order.tab.userId,
          playedAt,
        })
        .catch((error: unknown) =>
          this.logger.warn(`Falha ao registrar partida: ${String(error)}`),
        );
    }
  }

  private async findOrder(id: string) {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ORDER_RELATIONS,
    });
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    return order;
  }

  private async publishUpdate(orderId: string) {
    const order = await this.findOrder(orderId);
    this.notificationsGateway.emitToStaff('order:updated', order);
    this.notificationsGateway.emitToUser(
      order.tab.userId,
      'order:updated',
      order,
    );
    return order;
  }

  private async notifyCustomer(order: Order) {
    const { title, message, icon } = customerMessage(order);
    await this.notificationsService
      .sendToUser(order.tab.userId, title, message, icon, 'ALERT', {
        type: 'order',
        orderId: order.id,
      })
      .catch((error: unknown) =>
        this.logger.warn(`Falha ao avisar o cliente: ${String(error)}`),
      );
  }

  private withTotals(tab: OrderTab) {
    return {
      ...tab,
      orders: tab.orders.map((order) => ({
        ...order,
        total: orderTotal(order),
      })),
      total: tabTotal(tab.orders),
    };
  }
}
