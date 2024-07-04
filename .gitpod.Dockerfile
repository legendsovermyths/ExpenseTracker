# .gitpod.Dockerfile

FROM gitpod/workspace-full

# Install Neovim
RUN curl -LO https://github.com/neovim/neovim/releases/latest/download/nvim.appimage
RUN chmod u+x nvim.appimage
RUN sudo apt-get install fuse libfuse2
RUN sudo mv nvim.appimage /usr/local/bin/nvim
RUN git clone https://github.com/legendsovermyths/configs.git
RUN cp -r ./configs/nvim /home/gitpod/.config
RUN rm -r -f configs
#RUN sudo cp -r / /home/gitpod/.config
# Copy your Neovim configuration
#COPY / /home/gitpod/.config/

# Install Neovim plugins, LSP servers, and formatters
#RUN nvim

# Set correct permissions
#
