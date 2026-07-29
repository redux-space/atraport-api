import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Headers,
  Query,
} from "@nestjs/common";
import { AITriggersService } from "./ai-triggers.service";
import { TriggerConfigDto } from "./dto/trigger-config.dto";
import { PaginationQueryDto } from "../pagination/dto/pagination-query.dto";
import { CursorPaginationQueryDto } from "../pagination/dto/cursor-pagination-query.dto";

@Controller("api/ai-triggers")
export class AITriggerController {
  constructor(private readonly aiTriggersService: AITriggersService) {}

  @Post()
  createTrigger(@Body() triggerConfig: TriggerConfigDto) {
    console.log(triggerConfig);
    return this.aiTriggersService.createTrigger(triggerConfig);
  }

  @Get()
  listTriggers(@Query() pagination: PaginationQueryDto) {
    return this.aiTriggersService.findAll(pagination);
  }

  @Get('cursor')
  listTriggersCursor(@Query() pagination: CursorPaginationQueryDto) {
    return this.aiTriggersService.findAllCursor(pagination);
  }

  @Put(":trigger_id")
  updateTrigger(
    @Param("trigger_id") triggerId: string,
    @Body() triggerConfig: TriggerConfigDto,
  ) {
    return this.aiTriggersService.update(
      parseInt(triggerId, 10),
      triggerConfig,
    );
  }

  @Delete(":trigger_id")
  deleteTrigger(@Param("trigger_id") triggerId: string) {
    return this.aiTriggersService.remove(parseInt(triggerId, 10));
  }

  @Post("webhook")
  handleWebhook(@Body() data: any, @Headers("x-signature") signature: string) {
    if (!this.aiTriggersService.validateWebhookSignature(signature, data)) {
      throw new Error("Invalid signature");
    }
    return this.aiTriggersService.handleWebhook(data);
  }
}
