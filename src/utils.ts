import { Context } from 'telegraf';
import { BotContext } from './types';
import { MESSAGE_DELETE_DELAY } from './config';

export const answerAndDeleteLastMessage = async (ctx: Context) => {
  try {
    // ✅ Ensure this is a callback query before answering it
    if ('callbackQuery' in ctx && ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }
  } catch (err) {
    console.error('Error answering callback query: ', err);
  }

  const messageId =
    ctx.message?.message_id || ctx.callbackQuery?.message?.message_id;
  if (messageId) {
    try {
      await ctx.deleteMessage(messageId);
    } catch (err) {
      console.error('Error while deleting message: ', err);
    }
  }
};

export const deleteMessageWithDelay = (
  ctx: Context,
  message: any = null,
  delay = MESSAGE_DELETE_DELAY,
) => {
  setTimeout(() => {
    const messageId =
      message?.message_id ||
      ctx.callbackQuery?.message?.message_id ||
      ctx.message?.message_id;

    if (messageId) {
      ctx.deleteMessage(messageId).catch(() => {});
    }
  }, delay);
};

export const deleteLastMessage = async (ctx: BotContext) => {
  try {
    const messageId =
      ctx.message?.message_id || ctx.callbackQuery?.message?.message_id;
    if (messageId) {
      await ctx.deleteMessage(messageId - 1).catch(() => {});
    }
  } catch (err) {
    console.error('Error deleting messages:', err);
  }
};

export const checkPhoneAndReply = async (ctx: BotContext, newPhone: string) => {
  if (!/^\+?[0-9]{9,12}$/.test(newPhone)) {
    const message = await ctx.reply(
      '❌ Некорректный номер телефона. Введите снова.',
    );
    deleteMessageWithDelay(ctx, message);
    return;
  }
  return true;
};

export const formatDate = (
  dateString: string | Date,
  timeZone = 'Asia/Dushanbe',
) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};
