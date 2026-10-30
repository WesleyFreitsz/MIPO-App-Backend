// @nestjs/schedule 12 é ESM-only e o ts-jest roda em CommonJS; nos testes os crons são irrelevantes.
export const Cron = () => () => undefined;
export const CronExpression = {};
export class ScheduleModule {
  static forRoot() {
    return { module: ScheduleModule };
  }
}
