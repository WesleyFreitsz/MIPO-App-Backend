import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreVisit } from 'src/store-visits/entities/store-visit.entity';
import { Order } from 'src/orders/entities/order.entity';
import { VisitReview } from './entities/visit-review.entity';
import { OrderReview } from './entities/order-review.entity';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([VisitReview, OrderReview, StoreVisit, Order]),
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
