import React, {useEffect, useState} from "react";
import Blur from "../Blur.jsx";
import TaskMenuBtn from "./TaskMenuBtn.jsx";
import {TaskMenuColorPicker} from "./TaskMenuColorPicker.jsx";
import {Form} from "react-router-dom";
import {tryCatchDecorator, deleteTask} from "../../scripts/api.js";
import {useTaskMenu} from "../../contexts/TaskMenuContext.jsx";
import EasyMDE from "easymde";
import "easymde/dist/easymde.min.css";
