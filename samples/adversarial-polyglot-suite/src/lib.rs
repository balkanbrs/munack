use reqwest::Client;
use serde::Serialize;
use agentmesh_runtime::Supervisor;
use phantom_executor::TaskGraph;

#[derive(Serialize)]
pub struct BootstrapState {
    pub ready: bool,
}

pub fn bootstrap() -> BootstrapState {
    let _client = Client::new();
    let _supervisor = Supervisor::new();
    let _task_graph = TaskGraph::default();

    BootstrapState { ready: true }
}
