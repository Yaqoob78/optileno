
@router.post("/tasks/{task_id}/start", response_model=TaskOut)
async def start_task(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """Start a task (initial start or retry)."""
    result = await planner_service.start_task(str(current_user.id), task_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
