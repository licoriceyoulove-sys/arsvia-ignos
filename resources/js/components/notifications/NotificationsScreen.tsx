// resources/js/components/notifications/NotificationsScreen.tsx
import React from "react";
import { Card } from "../ui/Card";
import { SectionTitle } from "../ui/SectionTitle";

export const NotificationsScreen: React.FC = () => {
  return (
    <Card>
      <SectionTitle title="通知" />
      <div className="px-4 pb-4 text-sm text-gray-600">
        共有やいいね・RTの通知をここに表示できます。
      </div>
    </Card>
  );
};
