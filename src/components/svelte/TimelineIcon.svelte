<script lang="ts">
import { Timeline, TimelineElement } from "svelte-animated-timeline/src/lib";
import { getGithubId } from "../../lib/githubUsernameToId";
import generateId from "../../lib/generateElementId";

type ValidTimelineUsername =
  | "Null-n-V0id"
  | "MikeLime1901"
  | "LTNS5"
  | "joebobbio"
  | "kinglalu"
  | "trentwiles";

function getTimelineUsername(username: ValidTimelineUsername) {
  return `https://avatars.githubusercontent.com/u/${getGithubId(username)}`;
}
</script>

<Timeline id="timeline" triggerOnce={false} lineColor="#181825">
    <TimelineElement
        id={generateId("timeline icon 1")}
        date="2011 - present"
        contentStyle={{  }}
    />
</Timeline>