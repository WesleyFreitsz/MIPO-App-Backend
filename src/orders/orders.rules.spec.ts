import { OrderStatus } from './entities/order.entity';
import { OrderItemKind } from './entities/order-item.entity';
import {
  canTransition,
  customerMessage,
  shouldNotifyCustomer,
  orderTotal,
  startOfStoreDay,
  tabTotal,
} from './orders.rules';

describe('orders.rules', () => {
  it('só avança o pedido para frente e trava os status finais', () => {
    expect(canTransition(OrderStatus.PENDING, OrderStatus.PREPARING)).toBe(
      true,
    );
    expect(canTransition(OrderStatus.PREPARING, OrderStatus.DONE)).toBe(true);
    expect(canTransition(OrderStatus.PREPARING, OrderStatus.PENDING)).toBe(
      false,
    );
    expect(canTransition(OrderStatus.DONE, OrderStatus.CANCELED)).toBe(false);
    expect(canTransition(OrderStatus.CANCELED, OrderStatus.DONE)).toBe(false);
  });

  it('soma a comanda ignorando pedidos cancelados e arredonda centavos', () => {
    const items = [
      { unitPrice: 12.9, quantity: 2 },
      { unitPrice: 0.1, quantity: 3 },
    ];
    expect(orderTotal({ status: OrderStatus.DONE, items })).toBe(26.1);
    expect(
      tabTotal([
        { status: OrderStatus.DONE, items },
        { status: OrderStatus.CANCELED, items },
        { status: OrderStatus.PENDING, items: [{ unitPrice: 5, quantity: 1 }] },
      ]),
    ).toBe(31.1);
  });

  it('usa meia-noite de São Paulo como início do dia da loja', () => {
    expect(
      startOfStoreDay(new Date('2026-10-30T02:00:00Z')).toISOString(),
    ).toBe('2026-10-29T03:00:00.000Z');
    expect(
      startOfStoreDay(new Date('2026-10-30T15:00:00Z')).toISOString(),
    ).toBe('2026-10-30T03:00:00.000Z');
  });

  it('avisa o cliente do monitor a caminho, mas não do chamado encerrado', () => {
    const help = (status: OrderStatus) => ({
      status,
      canceledReason: null,
      items: [{ kind: OrderItemKind.HELP, nameSnapshot: 'Ajuda com Azul' }],
    });
    expect(shouldNotifyCustomer(help(OrderStatus.PREPARING))).toBe(true);
    expect(customerMessage(help(OrderStatus.PREPARING)).title).toBe(
      'Um monitor está a caminho',
    );
    expect(shouldNotifyCustomer(help(OrderStatus.DONE))).toBe(false);

    const food = (status: OrderStatus) => ({
      status,
      canceledReason: null,
      items: [{ kind: OrderItemKind.MENU, nameSnapshot: 'Pastel' }],
    });
    expect(shouldNotifyCustomer(food(OrderStatus.PREPARING))).toBe(false);
    expect(shouldNotifyCustomer(food(OrderStatus.DONE))).toBe(true);
  });
});
