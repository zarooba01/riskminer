import { PageHeader } from "@/components/layout/page-header";
import { AssessmentForm } from "@/components/rm/assessment-form";
import { Card, CardContent } from "@/components/ui/card";

type Props = { model?: string; region?: string };

/** Nowa ocena inwestycji: opis językiem naturalnym i/lub dokumenty, opcjonalnie analiza modelem AI. */
export function NewAssessmentView({ model, region }: Props) {
  return (
    <>
      <PageHeader
        title="Ocena nowej inwestycji"
        description="Opisz plan albo wgraj dokumenty. Dobierzemy podobne zakończone inwestycje, pokażemy, jak zmieniały się w nich koszty i terminy, oraz co sprawdzić przed przetargiem."
      />
      <Card>
        <CardContent>
          <AssessmentForm model={model} region={region} />
        </CardContent>
      </Card>
    </>
  );
}
