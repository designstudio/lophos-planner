import React from "react";
import { defaultProps, parseDefaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { Menu } from "@mantine/core";
import { DOMParser as PMDOMParser } from "@tiptap/pm/model";
import { MdCancel, MdCheckCircle, MdError, MdInfo } from "react-icons/md";

export const alertTypes = [
    {
        title: "Warning",
        value: "warning",
        icon: MdError,
    },
    {
        title: "Error",
        value: "error",
        icon: MdCancel,
    },
    {
        title: "Info",
        value: "info",
        icon: MdInfo,
    },
    {
        title: "Success",
        value: "success",
        icon: MdCheckCircle,
    },
];

function mapLegacyCalloutType(value) {
    const normalized = (value || "").toString().toLowerCase();

    if (normalized === "warning" || normalized === "caution") return "warning";
    if (normalized === "important" || normalized === "error") return "error";
    if (normalized === "tip" || normalized === "success") return "success";
    if (normalized === "note" || normalized === "info") return "info";
    return "warning";
}

export const createAlert = createReactBlockSpec(
    {
        type: "alert",
        propSchema: {
            textAlignment: defaultProps.textAlignment,
            textColor: defaultProps.textColor,
            type: {
                default: "warning",
                values: ["warning", "error", "info", "success"],
            },
        },
        content: "inline",
    },
    {
        parse: element => {
            if (element.tagName !== "DIV") return undefined;

            if (element.classList?.contains("alert")) {
                return {
                    ...parseDefaultProps(element),
                    type: mapLegacyCalloutType(element.getAttribute("data-alert-type")),
                };
            }

            const calloutClassName = Array.from(element.classList || []).find(className => className.startsWith("task-callout-"));
            if (element.classList?.contains("task-callout") || calloutClassName) {
                return {
                    ...parseDefaultProps(element),
                    type: mapLegacyCalloutType(calloutClassName?.replace("task-callout-", "")),
                };
            }

            return undefined;
        },
        parseContent: ({ el, schema }) => {
            const contentElement = el.querySelector(".inline-content, .task-callout-body");
            if (!contentElement) return undefined;

            const clone = contentElement.cloneNode(true);
            const paragraphs = clone.querySelectorAll("p");
            if (paragraphs.length > 1) {
                const firstParagraph = paragraphs[0];
                for (let index = 1; index < paragraphs.length; index += 1) {
                    const paragraph = paragraphs[index];
                    firstParagraph.innerHTML += `<br>${paragraph.innerHTML}`;
                    paragraph.remove();
                }
            }

            const parser = PMDOMParser.fromSchema(schema);
            const parsed = parser.parse(clone, {
                topNode: schema.nodes.paragraph.create(),
                preserveWhitespace: true,
            });

            return parsed.content;
        },
        render: props => {
            const alertType = alertTypes.find(item => item.value === props.block.props.type) || alertTypes[0];
            const Icon = alertType.icon;

            return (
                <div className="alert" data-alert-type={props.block.props.type}>
                    <Menu withinPortal={false}>
                        <Menu.Target>
                            <div className="alert-icon-wrapper" contentEditable={false}>
                                <Icon
                                    className="alert-icon"
                                    data-alert-icon-type={props.block.props.type}
                                    size={32}
                                />
                            </div>
                        </Menu.Target>
                        <Menu.Dropdown className="bn-menu-dropdown task-alert-menu">
                            <Menu.Label>Alert Type</Menu.Label>
                            <Menu.Divider />
                            {alertTypes.map(type => {
                                const ItemIcon = type.icon;

                                return (
                                    <Menu.Item
                                        key={type.value}
                                        leftSection={(
                                            <ItemIcon
                                                className="alert-icon"
                                                data-alert-icon-type={type.value}
                                            />
                                        )}
                                        onClick={() => props.editor.updateBlock(props.block, {
                                            type: "alert",
                                            props: { type: type.value },
                                        })}
                                    >
                                        {type.title}
                                    </Menu.Item>
                                );
                            })}
                        </Menu.Dropdown>
                    </Menu>
                    <div className="inline-content" ref={props.contentRef} />
                </div>
            );
        },
    }
);
