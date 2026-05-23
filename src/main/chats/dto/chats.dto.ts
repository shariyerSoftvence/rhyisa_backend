import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  Min,
} from 'class-validator';
import { LiveMediaType } from '../../../../generated/prisma/enums';


export class StartChatsDto {
  @ApiProperty({
    description: 'ID of the user to chat with',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsUUID()
  otherUserId!: string;
}

export class CreateMessageDto {
  @ApiProperty({
    description: 'Message content',
    example: 'Hello, how are you?',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'URL to media file (image, video, etc.)',
    example: 'https://example.com/media/image.jpg',
  })
  @IsOptional()
  @IsUrl()
  mediaUrl?: string;

  @ApiPropertyOptional({
    description: 'Type of media',
    enum: LiveMediaType,
    example: 'IMAGE',
  })
  @IsOptional()
  @IsEnum(LiveMediaType)
  mediaType?: LiveMediaType;
}

export class MessagePaginationDto {
  @ApiPropertyOptional({
    description: 'Cursor for pagination (message ID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of messages to fetch',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;
}

export enum ChatEvents {
  SEND_MESSAGE = 'chat:message_send',
  RECEIVE_MESSAGE = 'chat:message_receive',
  MESSAGE_SENT = 'chat:message_sent',
  MESSAGE_READ = 'chat:message_read',
  TYPING_START = 'chat:typing_start',
  TYPING_STOP = 'chat:typing_stop',
  USER_STATUS = 'user:status',
  USER_STATUS_CHANGED = 'user:status_changed',
  GET_USER_STATUS = 'user:get_status',
  SET_USER_STATUS = 'user:set_status',
  LOAD_CONVERSATIONS = 'chat:load_conversations',
  CONVERSATION_LIST = 'chat:conversation_list',
  LOAD_SINGLE_CONVERSATION = 'chat:load_single_conversation',
  CONVERSATION_MESSAGES = 'chat:conversation_messages',
}