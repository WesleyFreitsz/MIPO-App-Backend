import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { Game } from 'src/games/entities/game.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';
import { StoreVisitsService } from 'src/store-visits/store-visits.service';
import { GamePlaysService } from 'src/game-plays/game-plays.service';
import { OrdersService } from './orders.service';
import { MenuItem } from './entities/menu-item.entity';
import { OrderTab } from './entities/order-tab.entity';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItemKind } from './entities/order-item.entity';
import { orderTotal } from './orders.rules';

const repoMock = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  save: jest.fn((entity: unknown) => Promise.resolve(entity)),
  create: jest.fn((entity: unknown) => entity),
});

function uniqueViolation() {
  return new QueryFailedError('INSERT', [], {
    code: '23505',
  } as unknown as Error);
}

describe('OrdersService', () => {
  let menuRepository: ReturnType<typeof repoMock>;
  let tabRepository: ReturnType<typeof repoMock>;
  let orderRepository: ReturnType<typeof repoMock>;
  let gameRepository: ReturnType<typeof repoMock>;
  let storeVisits: { hasOpenVisit: jest.Mock; checkOutUser: jest.Mock };
  let service: OrdersService;

  beforeEach(() => {
    menuRepository = repoMock();
    tabRepository = repoMock();
    orderRepository = repoMock();
    gameRepository = repoMock();
    storeVisits = { hasOpenVisit: jest.fn(), checkOutUser: jest.fn() };
    service = new OrdersService(
      menuRepository as unknown as Repository<MenuItem>,
      tabRepository as unknown as Repository<OrderTab>,
      orderRepository as unknown as Repository<Order>,
      gameRepository as unknown as Repository<Game>,
      storeVisits as unknown as StoreVisitsService,
      {
        notifyAdmins: jest.fn().mockResolvedValue(undefined),
        sendToUser: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationsService,
      {
        emitToStaff: jest.fn(),
        emitToUser: jest.fn(),
      } as unknown as NotificationsGateway,
      {
        recordFromOrderItem: jest.fn().mockResolvedValue(undefined),
      } as unknown as GamePlaysService,
    );
  });

  it('exige check-in antes de abrir comanda', async () => {
    storeVisits.hasOpenVisit.mockResolvedValue(null);
    await expect(
      service.openTab('u1', { customerName: 'Ana', cardNumber: '12' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('devolve a comanda aberta em vez de abrir outra', async () => {
    storeVisits.hasOpenVisit.mockResolvedValue({ id: 'v1' });
    tabRepository.findOne.mockResolvedValue({ id: 't1', userId: 'u1' });
    const tab = await service.openTab('u1', {
      customerName: 'Ana',
      cardNumber: '12',
    });
    expect(tab).toMatchObject({ id: 't1' });
    expect(tabRepository.save).not.toHaveBeenCalled();
  });

  it('recusa cartão que já está em outra comanda aberta', async () => {
    storeVisits.hasOpenVisit.mockResolvedValue({ id: 'v1' });
    tabRepository.findOne.mockResolvedValue(null);
    tabRepository.save.mockRejectedValue(uniqueViolation());
    await expect(
      service.openTab('u1', { customerName: 'Ana', cardNumber: '12' }),
    ).rejects.toThrow(ConflictException);
  });

  it('grava nome e preço do item no pedido e jogo sai de graça', async () => {
    tabRepository.findOne.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      cardNumber: '12',
      customerName: 'Ana',
    });
    menuRepository.find.mockResolvedValue([
      Object.assign(new MenuItem(), { id: 'm1', name: 'Pastel', price: 9.5 }),
    ]);
    gameRepository.find.mockResolvedValue([{ id: 'g1', name: 'Azul' }]);
    let savedOrder: Partial<Order> = {};
    orderRepository.save.mockImplementation((order: unknown) => {
      savedOrder = { ...(order as Order), id: 'o1' };
      return Promise.resolve(savedOrder);
    });
    orderRepository.findOne.mockImplementation(() =>
      Promise.resolve({ ...savedOrder, status: OrderStatus.PENDING }),
    );

    const order = await service.createOrder('u1', {
      items: [
        { kind: OrderItemKind.MENU, menuItemId: 'm1', quantity: 2 },
        { kind: OrderItemKind.GAME, gameId: 'g1', quantity: 1 },
      ],
    });

    const items = order.items;
    expect(items.map((i) => [i.nameSnapshot, i.unitPrice, i.quantity])).toEqual(
      [
        ['Pastel', 9.5, 2],
        ['Azul', 0, 1],
      ],
    );
  });

  it('chamado de monitor entra com custo zero e não soma na comanda', async () => {
    tabRepository.findOne.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      cardNumber: '12',
      customerName: 'Ana',
    });
    gameRepository.find.mockResolvedValue([{ id: 'g1', name: 'Azul' }]);
    let savedOrder: Partial<Order> = {};
    orderRepository.save.mockImplementation((order: unknown) => {
      savedOrder = { ...(order as Order), id: 'o1' };
      return Promise.resolve(savedOrder);
    });
    orderRepository.findOne.mockImplementation(() =>
      Promise.resolve({ ...savedOrder, status: OrderStatus.PENDING }),
    );

    const order = await service.createOrder('u1', {
      items: [
        { kind: OrderItemKind.HELP, gameId: 'g1', quantity: 3, note: 'regra?' },
      ],
    });

    expect(order.items[0]).toMatchObject({
      kind: OrderItemKind.HELP,
      nameSnapshot: 'Ajuda com Azul',
      unitPrice: 0,
      quantity: 1,
    });
    expect(orderTotal(order)).toBe(0);
  });

  it('não deixa pedido finalizado voltar a ser preparado', async () => {
    orderRepository.findOne.mockResolvedValue({
      id: 'o1',
      status: OrderStatus.DONE,
      items: [],
      tab: { userId: 'u1' },
    });
    await expect(
      service.updateStatus('staff', 'o1', { status: OrderStatus.PREPARING }),
    ).rejects.toThrow(BadRequestException);
  });
});
