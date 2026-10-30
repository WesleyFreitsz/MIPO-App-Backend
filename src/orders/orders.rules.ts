import { OrderStatus } from './entities/order.entity';
import { OrderItemKind } from './entities/order-item.entity';

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [
    OrderStatus.PREPARING,
    OrderStatus.DONE,
    OrderStatus.CANCELED,
  ],
  [OrderStatus.PREPARING]: [OrderStatus.DONE, OrderStatus.CANCELED],
  [OrderStatus.DONE]: [],
  [OrderStatus.CANCELED]: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return NEXT_STATUSES[from].includes(to);
}

interface PricedOrder {
  status: OrderStatus;
  items: { unitPrice: number; quantity: number }[];
}

export function orderTotal(order: PricedOrder) {
  if (order.status === OrderStatus.CANCELED) return 0;
  return roundCents(
    order.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
  );
}

export function tabTotal(orders: PricedOrder[]) {
  return roundCents(orders.reduce((sum, order) => sum + orderTotal(order), 0));
}

interface CustomerFacingOrder {
  status: OrderStatus;
  canceledReason: string | null;
  items: { kind: OrderItemKind; nameSnapshot: string }[];
}

export function isHelpCall(order: Pick<CustomerFacingOrder, 'items'>) {
  return order.items.every((item) => item.kind === OrderItemKind.HELP);
}

export function shouldNotifyCustomer(order: CustomerFacingOrder) {
  if (order.status === OrderStatus.CANCELED) return true;
  const help = isHelpCall(order);
  if (order.status === OrderStatus.PREPARING) return help;
  return order.status === OrderStatus.DONE && !help;
}

export function customerMessage(order: CustomerFacingOrder) {
  const summary = order.items.map((item) => item.nameSnapshot).join(', ');
  if (order.status === OrderStatus.CANCELED) {
    return {
      title: isHelpCall(order) ? 'Chamado cancelado' : 'Pedido cancelado',
      message: `${summary}: ${order.canceledReason ?? 'cancelado pela equipe'}.`,
      icon: 'x-circle',
    };
  }
  if (isHelpCall(order)) {
    return {
      title: 'Um monitor está a caminho',
      message: `${summary}: já vamos até a sua mesa.`,
      icon: 'help-circle',
    };
  }
  return {
    title: 'Seu pedido está pronto!',
    message: `${summary} já está a caminho da sua mesa.`,
    icon: 'check',
  };
}

function roundCents(value: number) {
  return Math.round(value * 100) / 100;
}

const STORE_TIME_ZONE = 'America/Sao_Paulo';

export function startOfStoreDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: STORE_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  // shortcut: São Paulo is fixed at UTC-3 (no DST since 2019); use a tz library if DST returns.
  return new Date(Date.UTC(value('year'), value('month') - 1, value('day'), 3));
}
