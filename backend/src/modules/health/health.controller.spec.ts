import { Test } from '@nestjs/testing';
import { HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;
  const check = vi.fn();

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: { check } },
        { provide: MongooseHealthIndicator, useValue: { pingCheck: vi.fn() } },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('live() trả về status ok', () => {
    expect(controller.live().status).toBe('ok');
  });

  it('ready() gọi health check', async () => {
    check.mockResolvedValue({ status: 'ok' });
    await expect(controller.ready()).resolves.toEqual({ status: 'ok' });
    expect(check).toHaveBeenCalledOnce();
  });
});
