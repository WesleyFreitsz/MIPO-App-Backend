import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ReportType } from '../entities/report.entity';

export class CreateReportDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason: string;

  @IsUUID()
  reportedUserId: string;

  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;

  @IsOptional()
  @IsUUID()
  postId?: string;

  @IsOptional()
  @IsUUID()
  chatMessageId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Matches(/^https?:\/\//, { message: 'URL de imagem inválida' })
  imageUrl?: string | null;
}
