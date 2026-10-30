import { Equals, IsDateString, IsString, MaxLength } from 'class-validator';

export class SetBirthDateDto {
  @IsDateString({ strict: true }, { message: 'Data de nascimento inválida' })
  birthDate: string;
}

export class AcceptTermsDto {
  @Equals(true)
  accept: boolean;

  @IsString()
  @MaxLength(20)
  version: string;
}
