import React from "react";
import { ActionIcon, Menu } from "@mantine/core";
import {
    BlockNoteSchema,
    insertOrUpdateBlockForSlashMenu,
} from "@blocknote/core";
import {
    BasicTextStyleButton,
    BlockTypeSelect,
    FileCaptionButton,
    FileDeleteButton,
    FileDownloadButton,
    FilePreviewButton,
    FileReplaceButton,
    SuggestionMenuController,
    FormattingToolbar,
    FormattingToolbarController,
    CreateLinkButton,
    useEditorState,
    getDefaultReactSlashMenuItems,
    useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { en, pt } from "@blocknote/core/locales";
import { useBlockNoteEditor } from "@blocknote/react";
import { RiAlertLine, RiCheckLine, RiH1, RiListCheck3, RiListOrdered, RiListUnordered, RiQuoteText, RiText } from "react-icons/ri";
import { CheckSquareBroken, Palette } from "@untitledui/icons";
import { createAlert } from "./TaskNoteAlert.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAgendaTasks } from "../../scripts/api.js";
import {
    cloneTaskNoteBlocks,
    convertMarkdownTaskNoteToBlocks,
    exportBlockNoteToTaskNotePayload,
    getLegacyTaskNoteFallbackHtml,
    normalizeTaskNote,
    TASK_NOTE_FORMAT_BLOCKNOTE,
    TASK_NOTE_FORMAT_MARKDOWN,
} from "../../scripts/taskNotes.js";
import { t } from "../../scripts/i18n.js";

function getEmptyParagraphBlock() {
    return [{ type: "paragraph", content: "" }];
}

function MeetingIcon(props) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
            <path d="M13 3.5V6.2C13 7.88016 13 8.72024 13.327 9.36197C13.6146 9.92646 14.0735 10.3854 14.638 10.673C15.2798 11 16.1198 11 17.8 11H20.5M21 12.9882V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V7.8C3 6.11984 3 5.27976 3.32698 4.63803C3.6146 4.07354 4.07354 3.6146 4.63803 3.32698C5.27976 3 6.11984 3 7.8 3H11.0118C11.7455 3 12.1124 3 12.4577 3.08289C12.7638 3.15638 13.0564 3.27759 13.3249 3.44208C13.6276 3.6276 13.887 3.88703 14.4059 4.40589L19.5941 9.59411C20.113 10.113 20.3724 10.3724 20.5579 10.6751C20.7224 10.9436 20.8436 11.2362 20.9171 11.5423C21 11.8876 21 12.2545 21 12.9882Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 16H7M11 12H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function normalizeSearchText(text) {
    return (text || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function formatTaskMentionDate(date, language) {
    if (!date) return "";

    try {
        return new Intl.DateTimeFormat(language === "enUS" ? "en-US" : "pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }).format(new Date(`${date}T00:00:00`)).replace(/\./g, "");
    } catch {
        return "";
    }
}

function getBlockNoteBaseDictionary(language) {
    return language === "enUS" ? en : pt;
}

function buildBlockNoteDictionary(language) {
    const baseDictionary = getBlockNoteBaseDictionary(language);

    return {
        ...baseDictionary,
        placeholders: {
            ...baseDictionary.placeholders,
            default: t(language, "notesPlaceholder"),
            emptyDocument: t(language, "notesPlaceholder"),
        },
    };
}

const BACKGROUND_COLOR_OPTIONS = ["default", "gray", "red", "yellow", "green", "blue", "pink"];

const taskNoteSchema = BlockNoteSchema.create().extend({
    blockSpecs: {
        alert: createAlert(),
    },
});

function TaskColorIcon({ color }) {
    const backgroundMap = {
        default: "transparent",
        gray: "var(--color-river-bed-200)",
        red: "var(--color-shiraz-100)",
        yellow: "var(--color-bitter-lemon-100)",
        green: "var(--color-atlantis-100)",
        blue: "color-mix(in srgb, var(--color-brand-primary) 16%, white)",
        pink: "color-mix(in srgb, var(--color-shiraz-200) 60%, white)",
    };

    return (
        <span
            aria-hidden="true"
            className="inline-flex h-4 w-4 items-center justify-center rounded-[4px] text-[11px] leading-none"
            style={{ backgroundColor: backgroundMap[color] || "transparent", color: "var(--color-text-default)" }}
        >
            A
        </span>
    );
}

function TaskBackgroundColorButton() {
    const editor = useBlockNoteEditor();

    const state = useEditorState({
        editor,
        selector: ({ editor: currentEditor }) => {
            if (
                !currentEditor.isEditable
                || !((currentEditor.getSelection()?.blocks || [currentEditor.getTextCursorPosition().block])
                    .find(block => block.content !== undefined))
            ) {
                return undefined;
            }

            return {
                backgroundColor: currentEditor.getActiveStyles().backgroundColor || "default",
            };
        },
    });

    const setBackgroundColor = React.useCallback(color => {
        if (color === "default") {
            editor.removeStyles({ backgroundColor: color });
        } else {
            editor.addStyles({ backgroundColor: color });
        }

        setTimeout(() => {
            editor.focus();
        });
    }, [editor]);

    if (state === undefined) {
        return null;
    }

    return (
        <Menu withinPortal={false} position="bottom-start">
            <Menu.Target>
                <ActionIcon
                    aria-label={editor.dictionary.formatting_toolbar.colors.tooltip}
                    className="bn-button"
                    size={30}
                    radius="xl"
                    variant="subtle"
                >
                    <Palette className="h-4 w-4" />
                </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown className="bn-menu-dropdown bn-color-picker-dropdown">
                <Menu.Label>
                    {editor.dictionary.color_picker.background_title}
                </Menu.Label>
                {BACKGROUND_COLOR_OPTIONS.map(color => (
                    <Menu.Item
                        key={`background-color-${color}`}
                        onClick={() => setBackgroundColor(color)}
                        leftSection={<TaskColorIcon color={color} />}
                        rightSection={state.backgroundColor === color ? <RiCheckLine aria-hidden="true" /> : undefined}
                    >
                        {editor.dictionary.color_picker.colors[color]}
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    );
}

function TaskFormattingToolbar({ language }) {
    const editor = useBlockNoteEditor();

    const blockTypeItems = React.useMemo(() => [
        { name: editor.dictionary.slash_menu.paragraph.title, type: "paragraph", icon: RiText },
        { name: editor.dictionary.slash_menu.heading.title, type: "heading", props: { level: 1, isToggleable: false }, icon: RiH1 },
        { name: editor.dictionary.slash_menu.quote.title, type: "quote", icon: RiQuoteText },
        { name: t(language, "callout"), type: "alert", props: { type: "warning" }, icon: RiAlertLine },
        { name: editor.dictionary.slash_menu.bullet_list.title, type: "bulletListItem", icon: RiListUnordered },
        { name: editor.dictionary.slash_menu.numbered_list.title, type: "numberedListItem", icon: RiListOrdered },
        { name: editor.dictionary.slash_menu.check_list.title, type: "checkListItem", icon: RiListCheck3 },
    ], [editor.dictionary, language]);

    return (
        <FormattingToolbar blockTypeSelectItems={blockTypeItems}>
            <BlockTypeSelect items={blockTypeItems} />
            <FileCaptionButton />
            <FileReplaceButton />
            <FileDeleteButton />
            <FileDownloadButton />
            <FilePreviewButton />
            <BasicTextStyleButton basicTextStyle="bold" />
            <BasicTextStyleButton basicTextStyle="italic" />
            <BasicTextStyleButton basicTextStyle="underline" />
            <BasicTextStyleButton basicTextStyle="strike" />
            <TaskBackgroundColorButton />
            <CreateLinkButton />
        </FormattingToolbar>
    );
}

function TaskSlashMenu({ items, loadingState, selectedIndex, onItemClick }) {
    if ((loadingState === "loading" || loadingState === "loading-initial") && items.length === 0) {
        return (
            <div id="bn-suggestion-menu" className="task-inline-menu task-inline-menu-slash">
                <div className="task-inline-menu-empty">Carregando...</div>
            </div>
        );
    }

    const renderedItems = [];
    let currentGroup;

    for (let index = 0; index < items.length; index += 1) {
        const item = items[index];

        if (item.group !== currentGroup) {
            currentGroup = item.group;
            if (currentGroup) {
                renderedItems.push(
                    <div key={`group-${currentGroup}`} className="task-inline-menu-section">
                        <p className="task-inline-menu-title">{currentGroup}</p>
                    </div>
                );
            }
        }

        renderedItems.push(
            <button
                key={`${item.key}-${item.title}`}
                id={`bn-suggestion-menu-item-${index}`}
                type="button"
                role="option"
                aria-selected={index === selectedIndex || undefined}
                className={`task-inline-menu-option ${index === selectedIndex ? "is-active" : ""}`}
                onMouseDown={event => event.preventDefault()}
                onClick={() => onItemClick?.(item)}
            >
                {item.icon && (
                    <span className="task-inline-menu-option-icon">
                        {item.icon}
                    </span>
                )}
                <span className="task-inline-menu-option-content">
                    <span className="task-inline-menu-option-label">{item.title}</span>
                </span>
            </button>
        );
    }

    return (
        <div id="bn-suggestion-menu" className="task-inline-menu task-inline-menu-slash" role="listbox">
            {renderedItems}
            {renderedItems.length === 0 && loadingState === "loaded" ? (
                <div className="task-inline-menu-empty">Nenhum item encontrado.</div>
            ) : null}
        </div>
    );
}

function TaskMentionMenu({ items, loadingState, selectedIndex, onItemClick, language }) {
    if ((loadingState === "loading" || loadingState === "loading-initial") && items.length === 0) {
        return (
            <div id="bn-suggestion-menu" className="task-inline-menu task-inline-menu-mention">
                <div className="task-inline-menu-empty">{t(language, "loadingShort")}</div>
            </div>
        );
    }

    return (
        <div id="bn-suggestion-menu" className="task-inline-menu task-inline-menu-mention" role="listbox">
            {items.map((item, index) => (
                <button
                    key={`${item.key}-${item.title}`}
                    id={`bn-suggestion-menu-item-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === selectedIndex || undefined}
                    className={`task-inline-menu-option ${index === selectedIndex ? "is-active" : ""}`}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => onItemClick?.(item)}
                >
                    {item.icon && (
                        <span className="task-inline-menu-option-icon">
                            {item.icon}
                        </span>
                    )}
                    <span className="task-inline-menu-option-content">
                        <span className="task-inline-menu-option-label">{item.title}</span>
                        {item.subtext ? (
                            <span className="task-inline-menu-option-meta">{item.subtext}</span>
                        ) : null}
                    </span>
                </button>
            ))}
            {items.length === 0 && loadingState === "loaded" ? (
                <div className="task-inline-menu-empty">{t(language, "mentionNoResults")}</div>
            ) : null}
        </div>
    );
}

const BLOCKED_SLASH_MENU_KEYS = new Set([
    "heading_2",
    "heading_3",
    "heading_4",
    "heading_5",
    "heading_6",
    "toggle_heading",
    "toggle_heading_2",
    "toggle_heading_3",
    "toggle_list",
    "code_block",
    "divider",
    "video",
    "audio",
    "file",
]);

function getActiveFormatsFromEditor(editor) {
    const cursor = editor.getTextCursorPosition();
    const block = cursor?.block;
    const styles = editor.getActiveStyles();

    return {
        heading: block?.type === "heading",
        bold: Boolean(styles.bold),
        italic: Boolean(styles.italic),
        strikethrough: Boolean(styles.strike),
        "unordered-list": block?.type === "bulletListItem",
        "ordered-list": block?.type === "numberedListItem",
    };
}

const TaskNoteEditor = React.forwardRef(function TaskNoteEditor({
    task,
    language,
    onNoteChange,
    onActiveFormatsChange,
    onFocusChange,
    onTaskMentionClick,
    readOnly = false,
    className = "",
}, ref) {
    const { currentUser } = useAuth();
    const rootRef = React.useRef(null);
    const note = React.useMemo(() => normalizeTaskNote(task), [task]);
    const isApplyingExternalStateRef = React.useRef(false);
    const latestNoteSnapshotRef = React.useRef({
        taskId: task?.id ?? null,
        isDirty: false,
        ...note,
    });
    const dictionary = React.useMemo(() => buildBlockNoteDictionary(language), [language]);
    const editor = useCreateBlockNote({
        schema: taskNoteSchema,
        initialContent: getEmptyParagraphBlock(),
        dictionary,
    }, [dictionary]);
    const [mentionTasks, setMentionTasks] = React.useState([]);
    const [viewState, setViewState] = React.useState({
        loading: true,
        fallback: false,
        fallbackHtml: "",
    });

    React.useEffect(() => {
        latestNoteSnapshotRef.current = {
            taskId: task?.id ?? null,
            isDirty: false,
            ...note,
        };
    }, [note, task?.id]);

    const emitActiveFormats = React.useCallback(() => {
        onActiveFormatsChange?.(getActiveFormatsFromEditor(editor));
    }, [editor, onActiveFormatsChange]);

    const getSlashMenuItems = React.useCallback(async query => {
        const items = getDefaultReactSlashMenuItems(editor).filter(item => !BLOCKED_SLASH_MENU_KEYS.has(item.key));
        items.splice(3, 0, {
            title: t(language, "callout"),
            subtext: t(language, "slashCalloutDescription"),
            aliases: ["callout", "alert", "info", "nota"],
            group: editor.dictionary.slash_menu.quote.group,
            icon: <RiAlertLine />,
            onItemClick: () => {
                insertOrUpdateBlockForSlashMenu(editor, {
                    type: "alert",
                    props: { type: "warning" },
                });
            },
        });

        return filterSuggestionItems(items, query);
    }, [editor, language]);

    const getMentionMenuItems = React.useCallback(async query => {
        const normalizedQuery = normalizeSearchText(query);

        return mentionTasks
            .filter(item => {
                if (!normalizedQuery) return true;

                const haystack = normalizeSearchText(`${item.title} ${item.subtext || ""}`);
                return haystack.includes(normalizedQuery);
            })
            .slice(0, 8)
            .map(item => ({
                key: item.id,
                title: item.title,
                subtext: item.subtext,
                taskId: item.id,
                href: `#task:${item.id}`,
                icon: item.taskType === "meeting"
                    ? <MeetingIcon className="h-4 w-4" />
                    : <CheckSquareBroken className="h-4 w-4" />,
            }));
    }, [mentionTasks]);

    const renderFormattingToolbar = React.useCallback(
        () => <TaskFormattingToolbar language={language} />,
        [language]
    );

    const handleMentionItemClick = React.useCallback(item => {
        editor.insertInlineContent([
            {
                type: "link",
                href: item.href,
                content: item.title,
            },
            " ",
        ]);
        editor.focus();
    }, [editor]);

    React.useEffect(() => {
        if (readOnly) {
            setMentionTasks([]);
            return undefined;
        }

        let isCancelled = false;

        async function loadMentionTasks() {
            if (!currentUser?.currentAgendaId) {
                setMentionTasks([]);
                return;
            }

            try {
                const tasks = await getAgendaTasks(currentUser.currentAgendaId);
                if (isCancelled) return;

                setMentionTasks(
                    (tasks || [])
                        .filter(item => String(item.id) !== String(task?.id))
                        .map(item => ({
                            id: item.id,
                            title: item.name || t(language, "untitledLink"),
                            subtext: formatTaskMentionDate(item.date, language),
                            taskType: item.task_type || "task",
                        }))
                );
            } catch {
                if (!isCancelled) {
                    setMentionTasks([]);
                }
            }
        }

        loadMentionTasks();

        return () => {
            isCancelled = true;
        };
    }, [currentUser?.currentAgendaId, language, readOnly, task?.id]);

    const handleMentionClick = React.useCallback(event => {
        if (!onTaskMentionClick) return;

        const eventTarget = event.target;
        if (!(eventTarget instanceof Element)) return;

        const mentionLink = eventTarget.closest('a[href^="#task:"]');
        if (!mentionLink) return;

        const href = mentionLink.getAttribute("href") || "";
        const taskId = href.replace(/^#task:/, "").trim();
        if (!taskId) return;

        mentionLink.setAttribute("target", "_self");
        mentionLink.removeAttribute("rel");
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
        }
        onTaskMentionClick?.(taskId);
    }, [onTaskMentionClick]);

    React.useEffect(() => {
        const rootElement = rootRef.current;
        if (!rootElement || !onTaskMentionClick) return undefined;

        const interceptMentionNavigation = event => {
            handleMentionClick(event);
        };

        rootElement.addEventListener("pointerdown", interceptMentionNavigation, true);
        rootElement.addEventListener("click", interceptMentionNavigation, true);
        rootElement.addEventListener("auxclick", interceptMentionNavigation, true);

        return () => {
            rootElement.removeEventListener("pointerdown", interceptMentionNavigation, true);
            rootElement.removeEventListener("click", interceptMentionNavigation, true);
            rootElement.removeEventListener("auxclick", interceptMentionNavigation, true);
        };
    }, [handleMentionClick, onTaskMentionClick]);

    const toggleCurrentBlockType = React.useCallback((activeType, nextBlock) => {
        const cursor = editor.getTextCursorPosition();
        const block = cursor?.block;
        if (!block) return;

        editor.updateBlock(block, block.type === activeType ? { type: "paragraph" } : nextBlock);
        editor.focus();
        emitActiveFormats();
    }, [editor, emitActiveFormats]);

    React.useImperativeHandle(ref, () => ({
        focus() {
            editor.focus();
        },
        toggleHeading() {
            toggleCurrentBlockType("heading", {
                type: "heading",
                props: { level: 1 },
            });
        },
        toggleBold() {
            editor.toggleStyles({ bold: true });
            editor.focus();
            emitActiveFormats();
        },
        toggleItalic() {
            editor.toggleStyles({ italic: true });
            editor.focus();
            emitActiveFormats();
        },
        toggleStrikethrough() {
            editor.toggleStyles({ strike: true });
            editor.focus();
            emitActiveFormats();
        },
        toggleBulletList() {
            toggleCurrentBlockType("bulletListItem", { type: "bulletListItem" });
        },
        toggleNumberedList() {
            toggleCurrentBlockType("numberedListItem", { type: "numberedListItem" });
        },
    }), [editor, emitActiveFormats, toggleCurrentBlockType]);

    React.useEffect(() => {
        let isCancelled = false;

        async function loadNote() {
            const sourceNote = latestNoteSnapshotRef.current?.taskId === (task?.id ?? null)
                ? latestNoteSnapshotRef.current
                : {
                    taskId: task?.id ?? null,
                    isDirty: false,
                    ...note,
                };

            setViewState({
                loading: true,
                fallback: false,
                fallbackHtml: "",
            });

            isApplyingExternalStateRef.current = true;

            if (sourceNote.format === TASK_NOTE_FORMAT_BLOCKNOTE && Array.isArray(sourceNote.blocks)) {
                const blocks = sourceNote.blocks.length > 0 ? sourceNote.blocks : getEmptyParagraphBlock();
                editor.replaceBlocks(editor.document, blocks);

                if (!isCancelled) {
                    setViewState({
                        loading: false,
                        fallback: false,
                        fallbackHtml: "",
                    });
                    onNoteChange?.({
                        isDirty: false,
                        format: TASK_NOTE_FORMAT_BLOCKNOTE,
                        description: sourceNote.markdown,
                        note_format: TASK_NOTE_FORMAT_BLOCKNOTE,
                        note_blocks: blocks,
                        note_plain_text: sourceNote.plainText,
                        note_migrated_at: sourceNote.migratedAt,
                    });
                    emitActiveFormats();
                }

                requestAnimationFrame(() => {
                    isApplyingExternalStateRef.current = false;
                });
                return;
            }

            const conversion = await convertMarkdownTaskNoteToBlocks(editor, sourceNote.markdown);
            if (isCancelled) return;

            if (conversion.fallback) {
                setViewState({
                    loading: false,
                    fallback: true,
                    fallbackHtml: conversion.fallbackHtml || getLegacyTaskNoteFallbackHtml(sourceNote.markdown),
                });
                onNoteChange?.({
                    isDirty: false,
                    format: TASK_NOTE_FORMAT_MARKDOWN,
                    description: sourceNote.markdown,
                    note_format: TASK_NOTE_FORMAT_MARKDOWN,
                    note_blocks: null,
                    note_plain_text: "",
                    note_migrated_at: null,
                });
                onActiveFormatsChange?.({
                    heading: false,
                    bold: false,
                    italic: false,
                    strikethrough: false,
                    "unordered-list": false,
                    "ordered-list": false,
                });
                requestAnimationFrame(() => {
                    isApplyingExternalStateRef.current = false;
                });
                return;
            }

            const blocks = Array.isArray(conversion.blocks) && conversion.blocks.length > 0
                ? conversion.blocks
                : getEmptyParagraphBlock();

            editor.replaceBlocks(editor.document, blocks);
            setViewState({
                loading: false,
                fallback: false,
                fallbackHtml: "",
            });
            onNoteChange?.({
                isDirty: false,
                format: TASK_NOTE_FORMAT_MARKDOWN,
                description: sourceNote.markdown,
                note_format: TASK_NOTE_FORMAT_MARKDOWN,
                note_blocks: null,
                note_plain_text: "",
                note_migrated_at: null,
            });
            emitActiveFormats();

            requestAnimationFrame(() => {
                isApplyingExternalStateRef.current = false;
            });
        }

        loadNote();

        return () => {
            isCancelled = true;
        };
    }, [
        editor,
        emitActiveFormats,
        note.blocks,
        note.format,
        note.markdown,
        note.migratedAt,
        note.plainText,
        onActiveFormatsChange,
        onNoteChange,
    ]);

    async function handleEditorChange() {
        if (readOnly) return;
        if (isApplyingExternalStateRef.current) return;

        const currentBlocks = cloneTaskNoteBlocks(editor.document);
        const optimisticMigratedAt = note.migratedAt || new Date().toISOString();

        latestNoteSnapshotRef.current = {
            taskId: task?.id ?? null,
            isDirty: true,
            format: TASK_NOTE_FORMAT_BLOCKNOTE,
            markdown: latestNoteSnapshotRef.current?.markdown || note.markdown,
            blocks: currentBlocks,
            plainText: latestNoteSnapshotRef.current?.plainText || note.plainText,
            migratedAt: optimisticMigratedAt,
        };

        onNoteChange?.({
            isDirty: true,
            format: TASK_NOTE_FORMAT_BLOCKNOTE,
            description: latestNoteSnapshotRef.current.markdown,
            note_format: TASK_NOTE_FORMAT_BLOCKNOTE,
            note_blocks: currentBlocks,
            note_plain_text: latestNoteSnapshotRef.current.plainText || "",
            note_migrated_at: optimisticMigratedAt,
        });

        const payload = await exportBlockNoteToTaskNotePayload(editor, {
            migratedAt: note.migratedAt,
        });

        latestNoteSnapshotRef.current = {
            taskId: task?.id ?? null,
            isDirty: true,
            format: TASK_NOTE_FORMAT_BLOCKNOTE,
            markdown: payload.description,
            blocks: payload.note_blocks,
            plainText: payload.note_plain_text,
            migratedAt: payload.note_migrated_at,
        };

        onNoteChange?.({
            isDirty: true,
            format: TASK_NOTE_FORMAT_BLOCKNOTE,
            ...payload,
        });
        emitActiveFormats();
    }

    if (viewState.loading) {
        return (
            <div className={className} aria-busy="true">
                {t(language, "loadingShort")}
            </div>
        );
    }

    if (viewState.fallback) {
        return (
            <div
                ref={rootRef}
                className={className}
                data-note-format="legacy-markdown"
                data-note-read-only={readOnly ? "true" : "false"}
                onClickCapture={handleMentionClick}
                dangerouslySetInnerHTML={{ __html: viewState.fallbackHtml }}
            />
        );
    }

    return (
        <div
            ref={rootRef}
            className={className}
            data-note-format="blocknote"
            data-note-read-only={readOnly ? "true" : "false"}
            onClickCapture={handleMentionClick}
        >
            <BlockNoteView
                editor={editor}
                onChange={handleEditorChange}
                onSelectionChange={emitActiveFormats}
                onFocus={() => onFocusChange?.(true)}
                onBlur={() => onFocusChange?.(false)}
                theme="light"
                editable={!readOnly}
                formattingToolbar={false}
                linkToolbar={false}
                sideMenu={false}
                slashMenu={false}
                tableHandles={!readOnly}
            >
                {!readOnly ? <FormattingToolbarController formattingToolbar={renderFormattingToolbar} /> : null}
                {!readOnly ? (
                    <SuggestionMenuController
                        triggerCharacter="/"
                        getItems={getSlashMenuItems}
                        suggestionMenuComponent={TaskSlashMenu}
                    />
                ) : null}
                {!readOnly ? (
                    <SuggestionMenuController
                        triggerCharacter="@"
                        getItems={getMentionMenuItems}
                        onItemClick={handleMentionItemClick}
                        suggestionMenuComponent={props => <TaskMentionMenu {...props} language={language} />}
                    />
                ) : null}
            </BlockNoteView>
        </div>
    );
});

export default TaskNoteEditor;

