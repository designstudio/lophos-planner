import React, { Suspense, useEffect } from 'react';
import { closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, rectIntersection, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import Lottie from "lottie-react";
import todoLoadingAnimation from "./assets/todo-loading.json";
import { useAuth } from "./contexts/AuthContext";
import Header from "./components/Header";
import { getAppLanguage, getLocale } from "./scripts/i18n.js";
import { closeForm, openForm, parseDateOnly } from "./scripts/utils.js";
import Task from "./components/tasks/Task.jsx";
import useIsMobileViewport from "./hooks/useIsMobileViewport.js";

const TaskListContainer = React.lazy(() => import("./components/tasks/TaskListContainer"));
const BoardViewContainer = React.lazy(() => import("./components/tasks/BoardViewContainer.jsx"));
const LoginForm = React.lazy(() => import("./components/forms/LoginForm"));
const SignUpForm = React.lazy(() => import("./components/forms/SignUpForm"));
const UpdateUserForm = React.lazy(() => import("./components/forms/UpdateUserForm"));
const ShareSettingsForm = React.lazy(() => import("./components/forms/ShareSettingsForm.jsx"));
const InviteCollaboratorForm = React.lazy(() => import("./components/forms/InviteCollaboratorForm.jsx"));
const CreateAgendaForm = React.lazy(() => import("./components/forms/CreateAgendaForm.jsx"));
const StatusGeneratorForm = React.lazy(() => import("./components/forms/StatusGeneratorForm.jsx"));
const ResetPasswordForm = React.lazy(() => import("./components/forms/ResetPasswordForm"));
const InvitePage = React.lazy(() => import("./components/InvitePage"));
const TaskMenu = React.lazy(() => import("./components/tasks/TaskMenu"));
const SearchTaskForm = React.lazy(() => import("./components/forms/SearchTaskForm.jsx"));

function AppLoadingScreen({ fixed = false }) {
    return (
        <div className={`${fixed ? "fixed inset-0 z-50" : "min-w-screen min-h-screen"} bg-white dark:bg-black`}>
            <div className="flex min-h-screen items-center justify-center">
                <Lottie animationData={todoLoadingAnimation} loop style={{ width: 84, height: 84 }} />
            </div>
        </div>
    );
}

function SurfaceFallback() {
    return <AppLoadingScreen fixed />;
}

function plannerCollisionDetection(args) {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length > 0) return pointerHits;

    const rectHits = rectIntersection(args);
    if (rectHits.length > 0) return rectHits;

    return closestCorners(args);
}

const DND_DEBUG = false;

function debugDnd(label, payload) {
    if (!DND_DEBUG) return;
    console.log(`[DND] ${label}`, payload);
}

function debugDuplicateTask(taskId, containers, context = {}) {
    if (!DND_DEBUG || containers.length <= 1) return;
    console.error("DND DUPLICATE TASK DETECTED", {
        taskId,
        containers,
        ...context,
    });
}

function resolveSourceMeta(activeData) {
    if (!activeData) return null;

    return {
        sourceZone: activeData.zone || null,
        sourceContainerId: activeData.containerId || null,
        sourceIndex: Number.isInteger(activeData.index) ? activeData.index : null,
    };
}

function resolveDropTarget(over) {
    const overData = over?.data?.current;
    if (!overData?.zone) return null;

    return {
        zone: overData.zone,
        overId: over ? String(over.id) : null,
        overType: overData.type || null,
        containerId: overData.containerId || null,
        containerIndex: Number.isInteger(overData.containerIndex) ? overData.containerIndex : null,
        columnId: overData.columnId ? String(overData.columnId) : null,
        taskId: overData.taskId ? String(overData.taskId) : null,
        index: Number.isInteger(overData.index) ? overData.index : null,
        itemCount: Number.isInteger(overData.itemCount) ? overData.itemCount : null,
    };
}

function describeDropOperation(activeData, target) {
    if (!activeData?.zone || !target?.zone) return "cancel/no-op";
    if (activeData.zone === target.zone && activeData.containerId === target.containerId) {
        return "reorder same container";
    }
    if (activeData.zone === "week" && target.zone === "week") return "move week → week";
    if (activeData.zone === "week" && target.zone === "board") return "move week → board";
    if (activeData.zone === "board" && target.zone === "week") return "move board → week";
    if (activeData.zone === "board" && target.zone === "board") return "move board → board";
    return "cancel/no-op";
}

function HomePage() {
    const { currentUser, agendas, isAuthReady, pendingAgendaInviteToken, isPasswordRecovery } = useAuth();
    const [isAboutOpen, setIsAboutOpen] = React.useState(false);
    const [activeDragMeta, setActiveDragMeta] = React.useState(null);
    const [currentDropTarget, setCurrentDropTarget] = React.useState(null);
    const weekDndApiRef = React.useRef(null);
    const boardDndApiRef = React.useRef(null);
    const isMobile = useIsMobileViewport();
    const language = getAppLanguage(currentUser?.language);
    const currentAgenda = agendas.find(agenda => String(agenda.id) === String(currentUser?.currentAgendaId));
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        if (currentUser?.darkMode || localStorage.theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [currentUser]);

    useEffect(() => {
        document.documentElement.lang = getLocale(language);
    }, [language]);

    useEffect(() => {
        const baseTitle = "Lophos Planner";
        const agendaName = (currentAgenda?.name || "").trim();
        document.title = agendaName ? `${agendaName} - ${baseTitle}` : baseTitle;
    }, [currentAgenda?.name]);

    useEffect(() => {
        const accent = currentAgenda?.color || 'var(--color-brand-accent)';
        document.documentElement.style.setProperty('--agenda-accent', accent);

        const soft = /^#([0-9a-fA-F]{6})$/.test(accent)
            ? `${accent}22`
            : 'var(--color-brand-accent-subtle)';
        document.documentElement.style.setProperty('--agenda-accent-soft', soft);
    }, [currentAgenda?.id, currentAgenda?.color]);

    useEffect(() => {
        if (!isAuthReady) return;

        if (isPasswordRecovery && currentUser) {
            closeForm("login-form");
            closeForm("signup-form");
            closeForm("reset-password-form");
            openForm("update-user-form");
        } else if (currentUser) {
            closeForm("login-form");
            closeForm("signup-form");
            closeForm("reset-password-form");
        } else {
            if (pendingAgendaInviteToken) {
                openForm("signup-form");
            } else {
                openForm("login-form");
            }
        }
    }, [currentUser, isAuthReady, pendingAgendaInviteToken, isPasswordRecovery]);

    if (!isAuthReady) {
        return <AppLoadingScreen />;
    }

    const registerWeekDndApi = api => {
        weekDndApiRef.current = api;
    };

    const registerBoardDndApi = api => {
        boardDndApiRef.current = api;
    };

    function validateRenderedTaskUniqueness(taskId, context = {}) {
        if (!DND_DEBUG || !taskId) return;

        const weekContainers = weekDndApiRef.current?.getRenderedTaskContainers?.(taskId) ?? [];
        const boardContainers = boardDndApiRef.current?.getRenderedTaskContainers?.(taskId) ?? [];
        const containers = [...weekContainers, ...boardContainers];
        debugDuplicateTask(taskId, containers, context);
    }

    function handleSharedDragStart(event) {
        if (isMobile) return;

        const activeData = event.active?.data?.current;
        if (!activeData?.task) return;

        const sourceMeta = resolveSourceMeta(activeData);
        setActiveDragMeta({
            taskId: String(event.active.id),
            sourceZone: activeData.zone,
            task: activeData.task,
            overlayWidth: event.active?.rect?.current?.initial?.width ?? null,
        });
        setCurrentDropTarget(null);
        debugDnd("onDragStart", {
            activeId: String(event.active.id),
            activeData,
            ...sourceMeta,
        });
    }

    function handleSharedDragOver(event) {
        if (isMobile) return;

        const activeData = event.active?.data?.current;
        if (!activeData?.task) return;

        const target = resolveDropTarget(event.over);
        setCurrentDropTarget(target);
        debugDnd("onDragOver", {
            activeId: String(event.active.id),
            overId: event.over ? String(event.over.id) : null,
            overData: event.over?.data?.current || null,
            resolvedTargetZone: target?.zone || null,
            resolvedTargetContainerId: target?.containerId || null,
            resolvedTargetIndex: target?.index ?? null,
        });
    }

    async function handleSharedDragEnd(event) {
        const activeData = event.active?.data?.current;
        const sourceMeta = resolveSourceMeta(activeData);
        const target = resolveDropTarget(event.over) || currentDropTarget;

        if (!activeData?.task || !target?.zone) {
            debugDnd("onDragEnd", {
                activeId: String(event.active.id),
                ...sourceMeta,
                operation: "cancel/no-op",
                reason: "missing target",
            });
            setCurrentDropTarget(null);
            setActiveDragMeta(null);
            return;
        }

        const operation = describeDropOperation(activeData, target);
        let result = null;

        if (target.zone === "week") {
            result = await weekDndApiRef.current?.commitDrop?.({
                activeId: String(event.active.id),
                activeData,
                target,
            });
        } else if (target.zone === "board") {
            result = await boardDndApiRef.current?.commitDrop?.({
                activeId: String(event.active.id),
                activeData,
                target,
            });
        }

        debugDnd("onDragEnd", {
            activeId: String(event.active.id),
            overId: event.over ? String(event.over.id) : null,
            ...sourceMeta,
            targetZone: target.zone,
            targetContainerId: target.containerId,
            targetIndex: target.index,
            operation,
            payload: result?.payload || null,
        });
        validateRenderedTaskUniqueness(String(event.active.id), {
            sourceContainer: sourceMeta?.sourceContainerId ?? null,
            targetContainer: target?.containerId ?? null,
            payload: result?.payload || null,
        });

        setCurrentDropTarget(null);
        setActiveDragMeta(null);
    }

    function handleSharedDragCancel() {
        debugDnd("onDragCancel", {
            activeTaskId: activeDragMeta?.taskId ?? null,
        });
        setCurrentDropTarget(null);
        setActiveDragMeta(null);
    }

    return (
        <div className="min-w-screen min-h-screen bg-white dark:bg-black">
            <main className="max-container">
                <Header onOpenAbout={() => setIsAboutOpen(true)} />
                <Suspense fallback={<SurfaceFallback />}>
                    {currentUser ? (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={plannerCollisionDetection}
                            onDragStart={handleSharedDragStart}
                            onDragOver={handleSharedDragOver}
                            onDragEnd={handleSharedDragEnd}
                            onDragCancel={handleSharedDragCancel}
                        >
                            <TaskListContainer
                                dndEnabled={!isMobile}
                                activeTaskId={activeDragMeta?.taskId ?? null}
                                onRegisterDndApi={registerWeekDndApi}
                            />
                            <BoardViewContainer
                                dndEnabled={!isMobile}
                                activeTaskId={activeDragMeta?.taskId ?? null}
                                onRegisterDndApi={registerBoardDndApi}
                            />
                            <DragOverlay dropAnimation={null}>
                                {activeDragMeta?.task ? (
                                    <div
                                        className="planner-task-overlay"
                                        style={activeDragMeta.overlayWidth ? { width: `${activeDragMeta.overlayWidth}px`, maxWidth: `${activeDragMeta.overlayWidth}px` } : undefined}
                                    >
                                        <Task
                                            data={activeDragMeta.task}
                                            taskListInd={0}
                                            date={parseDateOnly(activeDragMeta.task.date || new Date())}
                                            tasksCol={0}
                                            ind={0}
                                            relatedLinksEnabled={currentAgenda?.related_links_enabled ?? true}
                                            disableNativeDrag
                                            isOverlay
                                        />
                                    </div>
                                ) : null}
                            </DragOverlay>
                            <SearchTaskForm />
                            <UpdateUserForm recoveryMode={isPasswordRecovery} />
                            <CreateAgendaForm />
                            <StatusGeneratorForm />
                            <ShareSettingsForm />
                            <InviteCollaboratorForm />
                            <ResetPasswordForm />
                            <TaskMenu />
                        </DndContext>
                    ) : (
                        <>
                            <LoginForm />
                            <SignUpForm />
                            <ResetPasswordForm />
                        </>
                    )}
                    <InvitePage
                        isOpen={isAboutOpen}
                        onClose={() => setIsAboutOpen(false)}
                    />
                </Suspense>
            </main>
        </div>
    );
}

export default HomePage;
