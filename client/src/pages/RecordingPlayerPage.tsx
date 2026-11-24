import { useParams, useNavigate } from 'react-router-dom';
import { RecordingPlayer } from '../components/recording/RecordingPlayer';

export function RecordingPlayerPage() {
  const { recordingId } = useParams<{ recordingId: string }>();
  const navigate = useNavigate();

  const id = Number(recordingId);
  if (!id || Number.isNaN(id)) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground font-mono text-sm">
        Invalid recording identifier
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-background">
      <RecordingPlayer
        recordingId={id}
        mode="fullpage"
        onClose={() => navigate(-1)}
      />
    </div>
  );
}
