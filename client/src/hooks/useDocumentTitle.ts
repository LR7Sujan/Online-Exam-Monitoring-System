import { useEffect } from 'react';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title.includes('ProctorIQ') ? title : `${title} | ProctorIQ`;
    return () => {
      document.title = prevTitle;
    };
  }, [title]);
}
