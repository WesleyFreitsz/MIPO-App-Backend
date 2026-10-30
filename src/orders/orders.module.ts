import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from 'src/games/entities/game.entity';
import { StoreVisitsModule } from 'src/store-visits/store-visits.module';
import { GamePlaysModule } from 'src/game-plays/game-plays.module';
import { MenuItem } from './entities/menu-item.entity';
import { OrderTab } from './entities/order-tab.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { MenuController } from './menu.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MenuItem, OrderTab, Order, OrderItem, Game]),
    StoreVisitsModule,
    GamePlaysModule,
  ],
  controllers: [MenuController, OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
