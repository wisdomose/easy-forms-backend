import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return service status metadata', () => {
      expect(appController.getRoot()).toEqual({
        data: {
          service: 'FormEngine',
          status: 'ok',
        },
      });
    });
  });
});
