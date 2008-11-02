package org.dtk;

import java.io.IOException;
import java.io.PrintWriter;

import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.mozilla.javascript.ContextFactory;

public class BuilderServlet extends HttpServlet {
    private String builderPath;
  
    // *****************************************************
    public void init() throws ServletException {
        super.init();

        // Read in the builderPath.
        // - context-param
        // - Java system property
        ServletContext sc = getServletContext();
        builderPath = sc.getInitParameter("builderPath");
        sc.log("## builderPath 1 value is: " + builderPath);
       if (builderPath == null || builderPath.length() == 0) {
            builderPath = System.getProperty("builderPath");
            sc.log("## builderPath 2 value is: " + builderPath);
       }
       sc.log("## builderPath 3 value is: " + builderPath);
    }

    // *****************************************************
    public void doGet(HttpServletRequest req, HttpServletResponse res)
            throws ServletException, IOException {

        getServletContext().log("## doGet: builderPath: " + builderPath);
        BuilderContextAction contextAction = new BuilderContextAction(
                getServletConfig().getServletContext(), req, res, builderPath);
        ContextFactory.getGlobal().call(contextAction);
        if (contextAction.getException() != null) {
            throw new ServletException(contextAction.getException());
        } else {
            String result = contextAction.getResult();
            res.setCharacterEncoding("utf-8");
            res.setHeader("Content-Type", "application/x-javascript");
            res.setHeader("Content-disposition", "attachment; filename=dojo.js");
            PrintWriter writer = res.getWriter();
            writer.append(result);
        }
    }

}
