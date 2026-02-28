import { MobileBottomSheet } from '../../components/MobileBottomSheet';
import { PlannerPane, PlannerPaneProps } from './PlannerPane';

interface MobilePlannerSheetProps extends PlannerPaneProps {
  opened: boolean;
}

export function MobilePlannerSheet({ opened, ...plannerProps }: MobilePlannerSheetProps) {
  return (
    <MobileBottomSheet opened={opened}>
      <PlannerPane {...plannerProps} />
    </MobileBottomSheet>
  );
}
