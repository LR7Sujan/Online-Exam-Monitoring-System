import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { RouteErrorBoundary } from '../../components/ui/RouteErrorBoundary';

export function StyleguideLayout() {
  return (
    <div className="min-h-full pb-16">
      <RouteErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </RouteErrorBoundary>
    </div>
  );
}
