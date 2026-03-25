import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      data: {
        service: 'FormEngine',
        status: 'ok',
        storage: 'postgres-compatible',
        auth: ['workos-jwt', 'api-key'],
      },
    };
  }
}
