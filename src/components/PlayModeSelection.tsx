import { Bot, Swords, Users } from 'lucide-react';
import ScreenShell from './ScreenShell';
import PathTile from './PathTile';

interface PlayModeSelectionProps {
  caseTitle: string;
  /** Custom cases belong to one player, so an online opponent can't load them */
  isCustomCase: boolean;
  onVsAI: () => void;
  onOnline: () => void;
  onSameDevice: () => void;
  onBack: () => void;
}

export default function PlayModeSelection({ caseTitle, isCustomCase, onVsAI, onOnline, onSameDevice, onBack }: PlayModeSelectionProps) {
  return (
    <ScreenShell title="HOW DO YOU WANT TO PLAY?" subtitle={caseTitle} onBack={onBack} maxWidth="max-w-lg">
      <div className="space-y-4 mt-2">
        <PathTile
          onClick={onVsAI}
          icon={<Bot className="w-7 h-7 text-white" />}
          iconBg="bg-blue-600"
          title="VS AI"
          subtitle="Play solo. AI judge, witnesses and opposing counsel."
        />
        <PathTile
          onClick={onOnline}
          icon={<Swords className="w-7 h-7 text-white" />}
          iconBg="bg-orange-600"
          title="VS PLAYER ONLINE"
          subtitle={isCustomCase ? 'Online play is for preset cases only.' : 'Find an opponent or invite a friend. Each on their own device.'}
          badge={isCustomCase ? undefined : 'LIVE 1V1'}
          disabled={isCustomCase}
        />
        <PathTile
          onClick={onSameDevice}
          icon={<Users className="w-7 h-7 text-white" />}
          iconBg="bg-purple-600"
          title="SAME DEVICE"
          subtitle="Two people, one phone. Pass it back and forth each turn."
        />
      </div>
    </ScreenShell>
  );
}
