import { IsString, Matches } from 'class-validator';

const OPTIONAL_HEX_COLOR = /^(#[0-9a-fA-F]{3,8})?$/;

export class UpdateMemberColorDto {
  @IsString()
  @Matches(OPTIONAL_HEX_COLOR, { message: 'Cor inválida' })
  color: string;
}

export class UpdateMemberBackgroundDto {
  @IsString()
  @Matches(OPTIONAL_HEX_COLOR, { message: 'Cor inválida' })
  theme: string;
}
