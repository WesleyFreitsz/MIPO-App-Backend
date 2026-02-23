export class CreateRoomDto {
  type: 'salinha' | 'salao_interno' | 'salao_externo';

  date: string;

  startTime: string;

  endTime: string;

  activity?: string;

  activityType?: 'game' | 'custom';
}
