import { GsecScanner } from '@client/components/gsecs/gsec-scanner';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/gsecs')({ component: GsecScanner });
