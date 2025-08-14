import { Scenes } from 'telegraf';

interface RegisterWizardState extends Scenes.WizardSessionData {
  login?: string;
  phone?: string;
}

export type RegisterWizardContext = Scenes.WizardContext & {
  wizard: Scenes.WizardSession<RegisterWizardState>;
};

interface SessionData {
  [x: string]: number | undefined;
  waitingFor?: 'login' | 'phone' | 'search_user' | 'confirm_amount' | null;
  waitingForPayment?: number | null;
  paymentAmount?: number | null;
}

// export interface BotContext extends Context {
//   match?: RegExpMatchArray;
//   session: SessionData;
// }

export type BotContext = Scenes.WizardContext<RegisterWizardState> & {
  session: BotSession;
  match?: RegExpMatchArray;
  scene: Scenes.SceneContextScene<BotContext, Scenes.WizardSessionData>;
};
