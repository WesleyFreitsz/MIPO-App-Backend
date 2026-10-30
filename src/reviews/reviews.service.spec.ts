import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { StoreVisit } from 'src/store-visits/entities/store-visit.entity';
import { Order } from 'src/orders/entities/order.entity';
import { ReviewsService } from './reviews.service';
import { VisitReview } from './entities/visit-review.entity';
import { OrderReview } from './entities/order-review.entity';
import { aggregateReviewStats } from './reviews.stats';

const repoMock = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  exists: jest.fn(),
  save: jest.fn((entity: unknown) => Promise.resolve(entity)),
  create: jest.fn((entity: unknown) => entity),
});

describe('ReviewsService', () => {
  let visitReviews: ReturnType<typeof repoMock>;
  let visits: ReturnType<typeof repoMock>;
  let service: ReviewsService;

  beforeEach(() => {
    visitReviews = repoMock();
    visits = repoMock();
    service = new ReviewsService(
      visitReviews as unknown as Repository<VisitReview>,
      repoMock() as unknown as Repository<OrderReview>,
      visits as unknown as Repository<StoreVisit>,
      repoMock() as unknown as Repository<Order>,
    );
  });

  it('aceita só uma avaliação por visita', async () => {
    visits.findOne.mockResolvedValue({ id: 'v1', checkedOutAt: new Date() });
    visitReviews.save.mockRejectedValueOnce(
      new QueryFailedError('INSERT', [], { code: '23505' } as unknown as Error),
    );

    await expect(
      service.reviewVisit('u1', 'v1', { rating: 5 }),
    ).rejects.toThrow(ConflictException);
  });

  it('não avalia visita que ainda está aberta', async () => {
    visits.findOne.mockResolvedValue({ id: 'v1', checkedOutAt: null });

    await expect(
      service.reviewVisit('u1', 'v1', { rating: 4 }),
    ).rejects.toThrow(BadRequestException);
    expect(visitReviews.save).not.toHaveBeenCalled();
  });
});

describe('aggregateReviewStats', () => {
  const user = { id: 'u', name: 'Ana', nickname: null, avatarUrl: null };
  const review = (rating: number, comment: string | null = null) => ({
    rating,
    comment,
    createdAt: new Date('2026-10-10T20:00:00Z'),
    user,
  });

  it('calcula média, NPS e média por item do cardápio', () => {
    const stats = aggregateReviewStats(
      [review(5, 'top'), review(5), review(4), review(2)],
      [
        { rating: 5, items: [{ kind: 'MENU', nameSnapshot: 'Pastel' }] },
        { rating: 3, items: [{ kind: 'MENU', nameSnapshot: 'Pastel' }] },
        { rating: 4, items: [{ kind: 'HELP', nameSnapshot: 'Ajuda' }] },
      ],
    );

    expect(stats.average).toBe(4);
    expect(stats.nps).toBe(25);
    expect(stats.distribution.find((d) => d.stars === 5)?.count).toBe(2);
    expect(stats.recentComments).toHaveLength(1);
    expect(stats.menuItems).toEqual([{ name: 'Pastel', average: 4, count: 2 }]);
  });
});
