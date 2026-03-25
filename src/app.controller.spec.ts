import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({ controllers: [AppController] }).compile();
    controller = module.get(AppController);
  });

  it('returns service metadata', () => {
    expect(controller.getRoot()).toEqual({
      data: {
        service: 'FormEngine',
        status: 'ok',
        storage: 'postgres-compatible',
        auth: ['workos-jwt', 'api-key'],
      },
    });
  });
});
