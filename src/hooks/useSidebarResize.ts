import React from 'react';

interface UseSidebarResizeOptions {
  initialWidth?: number;
  minWidth?: number;
  minMapWidth?: number;
}

export const useSidebarResize = (options: UseSidebarResizeOptions = {}) => {
  const { initialWidth = 500, minWidth = 300, minMapWidth = 100 } = options;
  const [sidebarWidth, setSidebarWidth] = React.useState(initialWidth);

  const startResizing = React.useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    const startX = mouseDownEvent.clientX;
    const startWidth = sidebarWidth;

    const doDrag = (mouseMoveEvent: MouseEvent) => {
      const newWidth = startWidth + mouseMoveEvent.clientX - startX;
      if (newWidth > minWidth && newWidth < window.innerWidth - minMapWidth) {
        setSidebarWidth(newWidth);
      }
    };

    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth, minWidth, minMapWidth]);

  return { sidebarWidth, setSidebarWidth, startResizing };
};
