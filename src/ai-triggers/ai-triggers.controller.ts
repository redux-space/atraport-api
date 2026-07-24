import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Headers,
} from "@nestjs/common";
import { AITriggersService } from "./ai-triggers.service";
import { TriggerConfigDto } from "./dto/trigger-config.dto";

@Controller("api/ai-triggers")
export class AITriggerController {
  constructor(private readonly aiTriggersService: AITriggersService) {}

  @Post()
  createTrigger(@Body() triggerConfig: TriggerConfigDto) {
    console.log(triggerConfig);
    return this.aiTriggersService.createTrigger(triggerConfig);
  }

  @Get()
  listTriggers() {
    return this.aiTriggersService.findAll();
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
