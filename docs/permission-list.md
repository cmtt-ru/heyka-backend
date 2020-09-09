### Channels

| Permission name | Description | List of allowed users|
| ------------- |:-------------:| -----:|
| `channel.update` | Update the channel | `channel.owner`, `channel.admin`, `channel.moderator`, `workspace.admin`, `workspace.moderator` |
| `channel.delete` | Delete the channel | `channel.owner`, `channel.admin`, `channel.moderator`, `workspace.admin`, `workspace.moderator` |
| `channel.select` | Select the channel | `channel.participant` |
| `channel.deleteAllInvites` | Delete all invites to the channel | `channel.owner`, `channel.admin`, `channel.moderator`, `workspace.admin`, `workspace.moderator` |

### Workspaces

| Permission name | Description | List of allowed users|
| ------------- |:-------------:| -----:|
| `workspace.createChannel` | Create a channel in the workspace | `workspace.participant` expect `workspace.guest` |
| `workspace.invite` | Invite new user to the workspace | `workspace.participant` expect `workspace.guest` |
| `workspace.subscribeEvents` | Subscribe for socket event of the workspace | `workspace.participant` |
| `workspace.connectSlack` | Connect slack to the workspace | `workspace.admin` |