import { Scenes } from 'telegraf';

interface RegisterWizardState {
  login?: string;
  phone?: string;
}

export interface BotSession extends Scenes.WizardSessionData {
  state: RegisterWizardState;
  waitingFor?:
    | 'login'
    | 'phone'
    | 'search_user'
    | 'confirm_amount'
    | 'selecting_transaction'
    | 'confirm_receving'
    | null;
  waitingForPayment?: number | null;
  waitingForTransaction?: number | null;
  paymentAmount?: number | null;
}

export interface BotContext extends Scenes.WizardContext<BotSession> {
  match?: RegExpMatchArray;
}
