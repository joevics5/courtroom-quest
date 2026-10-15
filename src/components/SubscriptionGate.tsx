import { Crown, Zap, Users, Shield } from 'lucide-react';
import ModalSheet from './ModalSheet';
import { gameButton } from './ui';
import type { SubscriptionTier } from '../types';

interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  price: string;
  features: string[];
  icon: typeof Crown;
  color: string;
}

const plans: SubscriptionPlan[] = [
  {
    tier: 'free',
    name: 'Free',
    price: '$0',
    features: [
      'Unlimited text sessions',
      'All preset cases',
      'Custom case creation',
      'Multiplayer invites',
      'Voice witness interviews',
      'Full voiced trials'
    ],
    icon: Zap,
    color: 'from-blue-500 to-cyan-600'
  },
  {
    tier: 'basic',
    name: 'Basic',
    price: '$9.99/month',
    features: [
      'Unlimited text sessions',
      'All preset cases',
      'Custom case creation',
      'Multiplayer invites'
    ],
    icon: Zap,
    color: 'from-blue-500 to-cyan-600'
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: '$24.99/month',
    features: [
      'Everything in Basic',
      '120 voice minutes/month',
      'Voice witness interviews',
      'Priority support'
    ],
    icon: Crown,
    color: 'from-purple-500 to-pink-600'
  },
  {
    tier: 'max',
    name: 'Max',
    price: '$49.99/month',
    features: [
      'Everything in Pro',
      '300 voice minutes/month',
      '8 full voiced trials/month',
      'Advanced analytics'
    ],
    icon: Shield,
    color: 'from-orange-500 to-red-600'
  },
  {
    tier: 'family',
    name: 'Family/Lab',
    price: '$79.99/month',
    features: [
      'Everything in Max',
      '600 voice minutes/month (shared)',
      'Up to 4-6 accounts',
      'Perfect for study groups'
    ],
    icon: Users,
    color: 'from-green-500 to-emerald-600'
  }
];

interface Props {
  requiredTier?: SubscriptionTier;
  currentTier: SubscriptionTier;
  feature: string;
  onUpgrade?: () => void;
  onClose?: () => void;
}

export default function SubscriptionGate({ requiredTier, currentTier, feature, onUpgrade, onClose }: Props) {
  const tierHierarchy: SubscriptionTier[] = ['free', 'basic', 'pro', 'max', 'family'];
  const currentTierIndex = tierHierarchy.indexOf(currentTier);
  const requiredTierIndex = requiredTier ? tierHierarchy.indexOf(requiredTier) : -1;

  if (!requiredTier || currentTierIndex >= requiredTierIndex) {
    return null;
  }

  const recommendedPlan = plans.find(p => p.tier === requiredTier) || plans[0];

  return (
    <ModalSheet
      title={`Upgrade to access ${feature}`}
      subtitle="Choose a plan that fits your needs"
      icon={<recommendedPlan.icon className="w-6 h-6 text-[#FFD43B]" />}
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {plans.map((plan) => {
          const Icon = plan.icon;
          const isRecommended = plan.tier === requiredTier;

          return (
            <div
              key={plan.tier}
              className={`rounded-2xl p-4 border-2 transition-all bg-white/5 ${
                isRecommended
                  ? 'border-[#FFD43B] shadow-[0_0_22px_rgba(255,212,59,0.25)]'
                  : 'border-white/10'
              }`}
            >
              {isRecommended && (
                <div className="bg-[#FFD43B] text-black text-[10px] font-black px-2 py-1 rounded-full mb-2 inline-block">
                  RECOMMENDED
                </div>
              )}
              <div className={`inline-block p-2 bg-gradient-to-br ${plan.color} rounded-xl mb-3`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-game text-2xl leading-none text-white mb-1 uppercase">{plan.name}</h3>
              <div className="text-lg font-bold text-white mb-3">{plan.price}</div>
              <ul className="space-y-1">
                {plan.features.map((item, idx) => (
                  <li key={idx} className="text-white/70 text-xs flex items-start gap-1">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-5">
        <h3 className="text-xs font-black tracking-widest text-[#FFD43B] mb-3">PAY-PER-TRIAL OPTIONS</h3>
        <div className="grid grid-cols-3 gap-2">
          {[['$3.49', '15-min'], ['$5.99', '30-min'], ['$10.99', '60-min']].map(([price, len]) => (
            <div key={len} className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-white mb-1">{price}</div>
              <div className="text-white/60 text-xs">{len}</div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onUpgrade} className={`w-full ${gameButton('gold', 'md')}`}>
        Choose a Plan
      </button>
    </ModalSheet>
  );
}

export function canAccessFeature(currentTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  const tierHierarchy: SubscriptionTier[] = ['free', 'basic', 'pro', 'max', 'family'];
  return tierHierarchy.indexOf(currentTier) >= tierHierarchy.indexOf(requiredTier);
}

export function getTrialLimit(tier: SubscriptionTier): number {
  // No payment plan has been decided yet, so the free tier carries the
  // same unlimited-trial benefit as every paid tier for now. Revisit
  // once pricing is finalized.
  return Infinity;
}

export function canCreateCustomCase(tier: SubscriptionTier): boolean {
  return true;
}

export function isAdminEmail(email: string): boolean {
  const adminEmails = [
    'joevicsworld@gmail.com',
    'joevicstown@gmail.com',
    'joevicsmovies@gmail.com',
    'joevicscrew@gmail.com',
    'joevicsl and@gmail.com'
  ];
  return adminEmails.includes(email.toLowerCase());
}

export function hasVoiceAccess(tier: SubscriptionTier): boolean {
  // Same reasoning as getTrialLimit: pricing isn't finalized, so every
  // tier (including free) currently gets voice access.
  return true;
}
