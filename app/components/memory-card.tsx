import { Link } from "react-router";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export function MemoryCard({
  memory,
}: {
  memory: { _id: string; title: string; role: string };
}) {
  return (
    <Link to={`/memory/${memory._id}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader>
          <CardTitle>{memory.title}</CardTitle>
          <CardDescription>
            Published testonggng;jdslkhjgslkhjlksdhfgflkhsdklhslkhdflksdhflksdhlkf
            {memory.role === "owner" ? "Owned by you" : "Shared with you"}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
