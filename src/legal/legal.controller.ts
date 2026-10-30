import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { LEGAL_VERSION, MIN_AGE } from './legal.constants';
import { LEGAL_PAGES, LegalPage, renderLegalPage } from './legal-pages';

@Controller('legal')
export class LegalController {
  @Get('version')
  version() {
    return { version: LEGAL_VERSION, minAge: MIN_AGE };
  }

  @Get(':page')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  page(@Param('page') page: string) {
    if (!LEGAL_PAGES.includes(page as LegalPage)) {
      throw new NotFoundException('Página não encontrada');
    }
    return renderLegalPage(page as LegalPage);
  }
}
