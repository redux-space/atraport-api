import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { MonitoringController } from '../monitoring.controller';
import { MetricsService } from '../metrics.service';
import { HealthService } from '../health.service';
import { TracingService } from '../tracing.service';
import { PerformanceService } from '../performance.service';
import { AlertingService } from '../alerting.service';
import { LogAggregationService } from '../log-aggregation.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { UserRole } from '../../auth/entities/user.entity';

describe('MonitoringController (RBAC & Access Control)', () => {
  let controller: MonitoringController;
  let reflector: Reflector;

  const mockMetricsService = {
    getPrometheusMetricsText: jest.fn().mockReturnValue('# HELP http_requests_total'),
  };
  const mockHealthService = {
    getFullHealth: jest.fn().mockResolvedValue({ status: 'ok', timestamp: new Date().toISOString() }),
    getLiveness: jest.fn().mockResolvedValue({ status: 'ok' }),
    getReadiness: jest.fn().mockResolvedValue({ status: 'ready' }),
  };
  const mockTracingService = {
    getRecentTraces: jest.fn().mockReturnValue([]),
    getOpenTelemetryFormattedTraces: jest.fn().mockReturnValue([]),
  };
  const mockPerformanceService = {
    getSummary: jest.fn().mockReturnValue({ latencyP95: 12 }),
  };
  const mockAlertingService = {
    getRules: jest.fn().mockReturnValue([]),
    getFiredAlerts: jest.fn().mockReturnValue([]),
    triggerTestAlert: jest.fn().mockReturnValue({ id: 'alert-1', message: 'test' }),
  };
  const mockLogAggregationService = {
    queryLogs: jest.fn().mockReturnValue([]),
    getLokiFormattedLogs: jest.fn().mockReturnValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MonitoringController],
      providers: [
        Reflector,
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: HealthService, useValue: mockHealthService },
        { provide: TracingService, useValue: mockTracingService },
        { provide: PerformanceService, useValue: mockPerformanceService },
        { provide: AlertingService, useValue: mockAlertingService },
        { provide: LogAggregationService, useValue: mockLogAggregationService },
      ],
    }).compile();

    controller = module.get<MonitoringController>(MonitoringController);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('Security & RBAC Annotations', () => {
    it('should have RolesGuard applied at the controller class level', () => {
      const guards = Reflect.getMetadata('__guards__', MonitoringController);
      expect(guards).toBeDefined();
      expect(guards).toContain(RolesGuard);
    });

    it('should require UserRole.ADMIN at the controller class level', () => {
      const roles = reflector.get<UserRole[]>(ROLES_KEY, MonitoringController);
      expect(roles).toBeDefined();
      expect(roles).toEqual([UserRole.ADMIN]);
    });

    it('should mark health/liveness as explicitly @Public() for container orchestrator probes', () => {
      const handler = controller.getLiveness;
      const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, handler);
      expect(isPublic).toBe(true);
    });

    it('should mark health/readiness as explicitly @Public() for container orchestrator probes', () => {
      const handler = controller.getReadiness;
      const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, handler);
      expect(isPublic).toBe(true);
    });

    it('should NOT mark administrative monitoring endpoints as @Public()', () => {
      const adminHandlers = [
        controller.getMetrics,
        controller.getHealth,
        controller.getPerformanceSummary,
        controller.getAlerts,
        controller.triggerTestAlert,
        controller.getTraces,
        controller.getLogs,
        controller.getDashboardConfig,
      ];

      for (const handler of adminHandlers) {
        const isPublic = reflector.get<boolean>(IS_PUBLIC_KEY, handler);
        expect(isPublic).toBeFalsy();
      }
    });
  });

  describe('Endpoint Functionality', () => {
    it('getMetrics should delegate to metricsService', () => {
      const result = controller.getMetrics();
      expect(mockMetricsService.getPrometheusMetricsText).toHaveBeenCalled();
      expect(result).toBe('# HELP http_requests_total');
    });

    it('getLiveness should return status from healthService', async () => {
      const res = await controller.getLiveness();
      expect(mockHealthService.getLiveness).toHaveBeenCalled();
      expect(res).toEqual({ status: 'ok' });
    });

    it('getReadiness should return status from healthService', async () => {
      const res = await controller.getReadiness();
      expect(mockHealthService.getReadiness).toHaveBeenCalled();
      expect(res).toEqual({ status: 'ready' });
    });

    it('triggerTestAlert should invoke alertingService', () => {
      const res = controller.triggerTestAlert('Test notice');
      expect(mockAlertingService.triggerTestAlert).toHaveBeenCalledWith('Test notice');
      expect(res.status).toBe('success');
    });
  });
});
