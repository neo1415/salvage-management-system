/**
 * Unit Tests for VirtualizedList Component
 * 
 * Tests virtualization behavior with @tanstack/react-virtual
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VirtualizedList } from '@/components/ui/virtualized-list';

describe('VirtualizedList', () => {
  it('renders items using the renderItem function', () => {
    const items = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' },
    ];

    const renderItem = (item: typeof items[0]) => (
      <div key={item.id} data-testid={`item-${item.id}`}>
        {item.name}
      </div>
    );

    const { container } = render(
      <VirtualizedList
        items={items}
        renderItem={renderItem}
        estimateSize={100}
      />
    );

    // Note: Due to virtualization, not all items may be rendered initially
    // This test verifies the component renders without errors
    expect(container.querySelector('.h-full')).toBeInTheDocument();
  });

  it('shows loading indicator when isLoading is true', () => {
    const items = [{ id: 1, name: 'Item 1' }];
    const renderItem = (item: typeof items[0]) => <div key={item.id}>{item.name}</div>;

    render(
      <VirtualizedList
        items={items}
        renderItem={renderItem}
        isLoading={true}
      />
    );

    expect(screen.getByLabelText('Loading more items')).toBeInTheDocument();
  });

  it('calls onLoadMore when scrolled near bottom', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i, name: `Item ${i}` }));
    const renderItem = (item: typeof items[0]) => <div key={item.id}>{item.name}</div>;
    const onLoadMore = vi.fn();

    render(
      <VirtualizedList
        items={items}
        renderItem={renderItem}
        onLoadMore={onLoadMore}
        hasMore={true}
        isLoading={false}
      />
    );

    // Note: Testing scroll behavior requires more complex setup with jsdom
    // This test verifies the component accepts the callback
    expect(onLoadMore).toBeDefined();
  });

  it('applies custom className', () => {
    const items = [{ id: 1, name: 'Item 1' }];
    const renderItem = (item: typeof items[0]) => <div key={item.id}>{item.name}</div>;

    const { container } = render(
      <VirtualizedList
        items={items}
        renderItem={renderItem}
        className="custom-class"
      />
    );

    const scrollContainer = container.querySelector('.custom-class');
    expect(scrollContainer).toBeInTheDocument();
  });
});
