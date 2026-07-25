import { Link, useLocation, useNavigate } from "react-router";
import {
  useConvexAuth,
  useMutation,
  useQuery_experimental as useQuery,
} from "convex/react";
import { Plus } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useAuthKitUser } from "~/lib/auth";
import { Button } from "~/components/ui/button";
import { ThemeToggle } from "~/components/theme-toggle";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "~/components/ui/sidebar";

export function AppSidebar() {
  const user = useAuthKitUser();
  const { isAuthenticated } = useConvexAuth();
  const tripsResult = useQuery({
    query: api.trips.listMine,
    args: isAuthenticated ? {} : "skip",
  });
  const trips =
    tripsResult.status === "success" ? tripsResult.data : undefined;
  const memoriesResult = useQuery({
    query: api.memories.listMine,
    args: isAuthenticated ? {} : "skip",
  });
  const memories =
    memoriesResult.status === "success" ? memoriesResult.data : undefined;
  const createTrip = useMutation(api.trips.create);
  const createMemory = useMutation(api.memories.create);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // A memory whose trip I'm not a member of still needs to be reachable, so
  // "ungrouped" means: no trip, or a trip that isn't in my trips list.
  const myTripIds = new Set((trips ?? []).map((t) => t._id));
  const ungrouped = (memories ?? []).filter(
    (m) => !m.tripId || !myTripIds.has(m.tripId),
  );

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Signed in";

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="font-semibold"
              render={<Link to="/" />}
            >
              Memories
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Trips</SidebarGroupLabel>
          <SidebarGroupAction
            title="New trip"
            onClick={async () => navigate(`/trip/${await createTrip({})}`)}
          >
            <Plus />
            <span className="sr-only">New trip</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {(trips ?? []).map((trip) => (
                <SidebarMenuItem key={trip._id}>
                  <SidebarMenuButton
                    isActive={pathname === `/trip/${trip._id}`}
                    render={<Link to={`/trip/${trip._id}`} />}
                  >
                    <span>{trip.title}</span>
                  </SidebarMenuButton>
                  {trip.memories.length > 0 && (
                    <SidebarMenuSub>
                      {trip.memories.map((m) => (
                        <SidebarMenuSubItem key={m._id}>
                          <SidebarMenuSubButton
                            isActive={pathname === `/memory/${m._id}`}
                            render={<Link to={`/memory/${m._id}`} />}
                          >
                            <span>{m.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              ))}
              {trips !== undefined && trips.length === 0 && (
                <p className="px-2 py-1 text-xs text-muted-foreground">
                  No trips yet.
                </p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Memories</SidebarGroupLabel>
          <SidebarGroupAction
            title="New memory"
            onClick={async () =>
              navigate(`/memory/${await createMemory({})}`)
            }
          >
            <Plus />
            <span className="sr-only">New memory</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {ungrouped.map((m) => (
                <SidebarMenuItem key={m._id}>
                  <SidebarMenuButton
                    isActive={pathname === `/memory/${m._id}`}
                    render={<Link to={`/memory/${m._id}`} />}
                  >
                    <span>{m.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1.5">
          {user?.profilePictureUrl ? (
            <img
              src={user.profilePictureUrl}
              alt=""
              className="size-7 rounded-full"
            />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs">
              {displayName.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{displayName}</p>
            {user?.email && (
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            )}
          </div>
          <ThemeToggle />
          <form method="post" action="/signout">
            <Button variant="ghost" size="sm" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
