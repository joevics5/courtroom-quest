import { Crown, Zap, Users, Shield, X } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        )}
        <div className="text-center mb-6">
          <div className="inline-block p-3 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full mb-3">
            <recommendedPlan.icon className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Upgrade to Access {feature}</h2>
          <p className="text-white/60 text-sm">Choose a plan that fits your needs</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isRecommended = plan.tier === requiredTier;

            return (
              <div
                key={plan.tier}
                className={`bg-white/5 rounded-lg p-4 border-2 transition-all ${
                  isRecommended
                    ? 'border-blue-500 shadow-lg shadow-blue-500/20'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {isRecommended && (
                  <div className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full mb-2 inline-block">
                    RECOMMENDED
                  </div>
                )}
                <div className={`inline-block p-2 bg-gradient-to-br ${plan.color} rounded-lg mb-3`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                <div className="text-xl font-bold text-white mb-3">{plan.price}</div>
                <ul className="space-y-1">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="text-white/70 text-xs flex items-start gap-1">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="bg-white/5 rounded-lg p-4 mb-4">
          <h3 className="text-white font-bold mb-2 text-sm">Pay-Per-Trial Options</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white mb-1">$3.49</div>
              <div className="text-white/60 text-xs">15-min</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white mb-1">$5.99</div>
              <div className="text-white/60 text-xs">30-min</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-white mb-1">$10.99</div>
              <div className="text-white/60 text-xs">60-min</div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={onUpgrade}
            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all"
          >
            Choose a Plan
          </button>
        </div>
      </div>
    </div>
  );
}

export function canAccessFeature(currentTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  const tierHierarchy: SubscriptionTier[] = ['free', 'basic', 'pro', 'max', 'family'];
  return tierHierarchy.indexOf(currentTier) >= tierHierarchy.indexOf(requiredTier);
}

export function getTrialLimit(tier: SubscriptionTier): number {
  if (tier === 'free') return 3;
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
  return ['pro', 'max', 'family'].includes(tier);
}
