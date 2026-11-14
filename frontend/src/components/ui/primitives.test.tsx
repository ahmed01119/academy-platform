import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button } from './Button';
import { Input } from './Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card';
import { Modal } from './Modal';
import { Tabs, TabList, TabTrigger, TabContent } from './Tabs';
import { Badge } from './Badge';

describe('UI Primitives — Phase 2 Architecture Verification', () => {
  describe('Button component', () => {
    it('renders with default primary variant and children', () => {
      const html = renderToStaticMarkup(<Button>Click Me</Button>);
      expect(html).toContain('Click Me');
      expect(html).toContain('bg-(--accent-primary)');
      expect(html).toContain('type="button"');
    });

    it('renders danger variant correctly', () => {
      const html = renderToStaticMarkup(<Button variant="danger">Delete Item</Button>);
      expect(html).toContain('Delete Item');
      expect(html).toContain('bg-rose-600');
    });

    it('renders loading state with aria-busy and disables interaction', () => {
      const html = renderToStaticMarkup(
        <Button isLoading loadingText="Saving...">
          Save
        </Button>,
      );
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('disabled=""');
      expect(html).toContain('Saving...');
    });
  });

  describe('Input component', () => {
    it('renders label, input, and helper text', () => {
      const html = renderToStaticMarkup(
        <Input
          label="Email Address"
          placeholder="name@example.com"
          helperText="We will never share your email."
        />,
      );

      expect(html).toContain('Email Address');
      expect(html).toContain('placeholder="name@example.com"');
      expect(html).toContain('We will never share your email.');
    });

    it('displays error message and marks aria-invalid', () => {
      const html = renderToStaticMarkup(
        <Input label="Password" error="Password must be at least 8 characters" />,
      );

      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('role="alert"');
      expect(html).toContain('Password must be at least 8 characters');
      expect(html).toContain('border-rose-500');
    });
  });

  describe('Card component', () => {
    it('renders structured card parts correctly', () => {
      const html = renderToStaticMarkup(
        <Card interactive elevated>
          <CardHeader>
            <CardTitle>Session Stats</CardTitle>
            <CardDescription>Daily performance overview</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Content Body</p>
          </CardContent>
          <CardFooter>
            <span>Footer Note</span>
          </CardFooter>
        </Card>,
      );

      expect(html).toContain('Session Stats');
      expect(html).toContain('Daily performance overview');
      expect(html).toContain('Content Body');
      expect(html).toContain('Footer Note');
      expect(html).toContain('card-hover-interactive');
      expect(html).toContain('--bg-surface-elevated');
    });
  });

  describe('Modal component', () => {
    it('renders when isOpen is true and hides when false', () => {
      const closedHtml = renderToStaticMarkup(
        <Modal isOpen={false} onClose={() => {}} title="Test Modal">
          <p>Modal content</p>
        </Modal>,
      );
      expect(closedHtml).toBe('');

      const openHtml = renderToStaticMarkup(
        <Modal isOpen={true} onClose={() => {}} title="Test Modal">
          <p>Modal content</p>
        </Modal>,
      );
      expect(openHtml).toContain('role="dialog"');
      expect(openHtml).toContain('aria-modal="true"');
      expect(openHtml).toContain('Test Modal');
      expect(openHtml).toContain('Modal content');
    });
  });

  describe('Tabs component', () => {
    it('renders active tab content and triggers', () => {
      const html = renderToStaticMarkup(
        <Tabs activeTab="tab1" onChange={() => {}}>
          <TabList>
            <TabTrigger value="tab1">Overview</TabTrigger>
            <TabTrigger value="tab2">Settings</TabTrigger>
          </TabList>
          <TabContent value="tab1">Overview Content</TabContent>
          <TabContent value="tab2">Settings Content</TabContent>
        </Tabs>,
      );

      expect(html).toContain('Overview Content');
      expect(html).not.toContain('Settings Content');
      expect(html).toContain('role="tablist"');
      expect(html).toContain('aria-selected="true"');
    });
  });

  describe('Badge component', () => {
    it('renders with variant colors and dot', () => {
      const html = renderToStaticMarkup(
        <Badge variant="success" dot>
          Active
        </Badge>,
      );

      expect(html).toContain('Active');
      expect(html).toContain('bg-emerald-500/10');
      expect(html).toContain('rounded-full');
    });
  });
});
