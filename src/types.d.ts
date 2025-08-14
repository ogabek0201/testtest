import { Scenes } from 'telegraf';

interface RegisterWizardState {
  login?: string;
  phone?: string;
}

interface BotSession extends Scenes.WizardSessionData {
  state: RegisterWizardState;
  [x: string]: number | undefined;
  waitingFor?: 'login' | 'phone' | 'search_user' | 'confirm_amount' | null;
  waitingForPayment?: number | null;
  paymentAmount?: number | null;
}

export interface BotContext extends Scenes.WizardContext<BotSession> {
  match?: RegExpMatchArray;
}
