import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { TraceSpan } from './dto/monitoring.dto';

@Injectable()
export class TracingService {
  private spansBuffer: TraceSpan[] = [];
  private readonly maxBufferSize = 1000;

  public generateTraceId(): string {
    return crypto.randomBytes(16).toString('hex'); // 32 hex chars
  }

  public generateSpanId(): string {
    return crypto.randomBytes(8).toString('hex'); // 16 hex chars
  }

  public parseTraceparent(traceparent?: string): { traceId?: string; parentSpanId?: string } {
    if (!traceparent) return {};
    const parts = traceparent.trim().split('-');
    if (parts.length >= 4 && parts[0] === '00' && parts[1].length === 32 && parts[2].length === 16) {
      return {
        traceId: parts[1],
        parentSpanId: parts[2],
      };
    }
    return {};
  }

  public formatTraceparent(traceId: string, spanId: string): string {
    return `00-${traceId}-${spanId}-01`;
  }

  public startSpan(
    name: string,
    options: {
      traceId?: string;
      parentSpanId?: string;
      kind?: 'SERVER' | 'CLIENT' | 'INTERNAL';
      attributes?: Record<string, any>;
    } = {},
  ): TraceSpan {
    const traceId = options.traceId || this.generateTraceId();
    const spanId = this.generateSpanId();

    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId: options.parentSpanId,
      name,
      kind: options.kind || 'SERVER',
      startTimeMs: Date.now(),
      statusCode: 'UNSET',
      attributes: options.attributes || {},
      events: [],
    };

    return span;
  }

  public finishSpan(span: TraceSpan, statusCode: 'OK' | 'ERROR' = 'OK', additionalAttributes?: Record<string, any>): TraceSpan {
    span.endTimeMs = Date.now();
    span.durationMs = span.endTimeMs - span.startTimeMs;
    span.statusCode = statusCode;
    if (additionalAttributes) {
      span.attributes = { ...span.attributes, ...additionalAttributes };
    }

    this.recordSpan(span);
    return span;
  }

  public addSpanEvent(span: TraceSpan, name: string, attributes?: Record<string, any>) {
    span.events.push({
      name,
      timestampMs: Date.now(),
      attributes,
    });
  }

  public setSpanAttribute(span: TraceSpan, key: string, value: any) {
    span.attributes[key] = value;
  }

  private recordSpan(span: TraceSpan) {
    this.spansBuffer.unshift(span);
    if (this.spansBuffer.length > this.maxBufferSize) {
      this.spansBuffer.pop();
    }
  }

  public getRecentTraces(limit = 100, traceId?: string): TraceSpan[] {
    let results = this.spansBuffer;
    if (traceId) {
      results = results.filter((s) => s.traceId === traceId);
    }
    return results.slice(0, limit);
  }

  public getOpenTelemetryFormattedTraces(limit = 50) {
    const spans = this.getRecentTraces(limit);
    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'astraport-api' } },
              { key: 'service.version', value: { stringValue: '0.1.0' } },
            ],
          },
          scopeSpans: [
            {
              scope: { name: 'astraport-tracer', version: '1.0.0' },
              spans: spans.map((span) => ({
                traceId: span.traceId,
                spanId: span.spanId,
                parentSpanId: span.parentSpanId,
                name: span.name,
                kind: span.kind,
                startTimeUnixNano: `${span.startTimeMs}000000`,
                endTimeUnixNano: `${(span.endTimeMs || span.startTimeMs)}000000`,
                attributes: Object.entries(span.attributes).map(([k, v]) => ({
                  key: k,
                  value: typeof v === 'number' ? { doubleValue: v } : { stringValue: String(v) },
                })),
                status: { code: span.statusCode },
              })),
            },
          ],
        },
      ],
    };
  }
}
