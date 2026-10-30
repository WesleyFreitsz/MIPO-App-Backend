export interface ReviewForStats {
  rating: number;
  comment: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    nickname: string | null;
    avatarUrl: string | null;
  };
}

export interface RatedOrderItems {
  rating: number;
  items: { kind: string; nameSnapshot: string }[];
}

const RECENT_COMMENTS = 20;
const PROMOTER_RATING = 5;
const DETRACTOR_MAX_RATING = 3;

function average(values: number[]) {
  if (values.length === 0) return null;
  return (
    Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 100) /
    100
  );
}

export function aggregateReviewStats(
  visitReviews: ReviewForStats[],
  orderReviews: RatedOrderItems[],
) {
  const ratings = visitReviews.map((review) => review.rating);
  const distribution = [1, 2, 3, 4, 5].map((stars) => ({
    stars,
    count: ratings.filter((rating) => rating === stars).length,
  }));
  const promoters = ratings.filter((r) => r >= PROMOTER_RATING).length;
  const detractors = ratings.filter((r) => r <= DETRACTOR_MAX_RATING).length;

  const byItem = new Map<string, number[]>();
  for (const review of orderReviews) {
    for (const item of review.items) {
      if (item.kind !== 'MENU') continue;
      byItem.set(item.nameSnapshot, [
        ...(byItem.get(item.nameSnapshot) ?? []),
        review.rating,
      ]);
    }
  }

  return {
    count: ratings.length,
    average: average(ratings),
    nps: ratings.length
      ? Math.round(((promoters - detractors) / ratings.length) * 100)
      : null,
    distribution,
    recentComments: visitReviews
      .filter((review) => review.comment)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, RECENT_COMMENTS)
      .map((review) => ({
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        user: review.user,
      })),
    menuItems: [...byItem.entries()]
      .map(([name, values]) => ({
        name,
        average: average(values),
        count: values.length,
      }))
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0)),
  };
}

export function reviewsToCsv(reviews: ReviewForStats[]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = reviews.map((review) =>
    [
      review.createdAt.toISOString().slice(0, 10),
      escape(review.user.name),
      review.rating,
      escape(review.comment ?? ''),
    ].join(';'),
  );
  return ['data;nome;nota;comentario', ...lines].join('\n');
}
