import { createRoot } from 'react-dom/client';
import { Toaster } from 'host/ui';
import { Page } from './Page';

// Standalone dev: needs the host dev server running (it serves host/ui)
createRoot(document.getElementById('root')).render(
    <>
        <Page username="standalone" userId={2} token="" />
        <Toaster />
    </>,
);
